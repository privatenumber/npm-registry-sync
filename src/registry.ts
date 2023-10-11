import path from 'path';
import fs from 'fs';
import exists from 'fs.promises.exists';
import got, { type Got } from 'got';
import task, { type Task, type TaskAPI } from 'tasuku';
import { openJson } from 'reactive-json-file';
import pMap from 'p-map';
import { publish } from 'libnpmpublish';
import semver from 'semver';
import chainset from 'chainset';
import packageJson from '../package.json';
import { hasOwn } from './utils/has-own';
import { getNpmrc } from './utils/get-npmrc';
import { ping } from './utils/ping';
import type { RegistryOptions } from './utils/config';
import { getPackageInfo, type PackageInfo } from './utils/get-package-info';
import { atomicDownload } from './utils/atomic-download';
import type { RegistryMeta } from './types';
import { serializeRegistryMeta } from './utils/serialize-registry-meta';
import { getMissingPackages } from './utils/get-missing-packages';
import logger from './utils/logger';

const dataDirectoryPath = path.resolve('data');
const packagesDirectoryPath = path.join(dataDirectoryPath, 'packages');

class Registry {
	id: string;

	registryOptions: RegistryOptions;

	npmrc: ReturnType<typeof getNpmrc>;

	meta: RegistryMeta;

	got: Got;

	lastTask?: Promise<TaskAPI>;

	constructor(
		id: string,
		registryOptions: RegistryOptions,
	) {
		this.id = id;
		this.registryOptions = registryOptions;
		this.npmrc = getNpmrc(this.registryOptions.npmrc);

		const registryUrl = new URL(this.registryOptions.url);
		const authTokenKey = Object.keys(this.npmrc).find(key => key.includes('_authToken') && key.includes(registryUrl.hostname + registryUrl.pathname));

		this.got = got.extend({
			prefixUrl: this.registryOptions.url,
			headers: {
				authorization: authTokenKey ? `Bearer ${this.npmrc[authTokenKey]}` : undefined,
			},
			https: {
				rejectUnauthorized: this.registryOptions.strictSSL ?? true,
			},
		});

		fs.mkdirSync(dataDirectoryPath, { recursive: true });

		this.meta = openJson(
			path.join(dataDirectoryPath, `${this.id}.json`),
			{
				default: {
					url: this.registryOptions.url,
					lastPolled: undefined,
					lastPolledSuccess: undefined,
					packages: {},
				} as RegistryMeta,
				serialize: serializeRegistryMeta,
			},
		);

		this.meta.packages = chainset(this.meta.packages);
	}

	async fetch(
		registries: Registry[],
		pollingIntervalSeconds: number,
	) {
		if (this.lastTask) {
			const lastTaskApi = await this.lastTask;
			lastTaskApi.clear();
		}

		this.lastTask = task(
			this.registryOptions.name,
			async ({ task, setStatus, setWarning }) => {
				const pollTime = new Date();

				this.meta.lastPolled = pollTime.getTime();

				setStatus('Checking connectivity');
				if (!await ping(this.got)) {
					logger.error(this.id, 'Failed to reach registry');
					setStatus('Not reachable');
					setWarning();
					return;
				}

				if (this.registryOptions.packages) {
					setStatus('Fetching packages');
					await pMap(
						this.registryOptions.packages,
						async packageName => await this.fetchPackage(task, packageName),
						{ concurrency: 2 },
					);
				}

				setStatus('Publishing missing packages');
				const missingPackages = getMissingPackages(this, registries);
				for (const [packageName, versions] of Object.entries(missingPackages)) {
					const versionsSorted = Object.entries(versions);
					versionsSorted.sort(([a], [b]) => semver.compare(a, b));

					for (const [version, tarballPath] of versionsSorted) {
						if (typeof tarballPath === 'string') {
							await this.publishTarball(
								task,
								packageName,
								version,
								path.join(packagesDirectoryPath, tarballPath),
							);
						}
					}
				}

				logger.info(this.id, 'Registry polled');
				setStatus(`Polled at ${pollTime.toLocaleTimeString()}`);
				this.meta.lastPolledSuccess = this.meta.lastPolled;
			},
		);

		await this.lastTask;

		setTimeout(
			() => this.fetch(registries, pollingIntervalSeconds),
			pollingIntervalSeconds * 1000,
		);
	}

	async fetchPackage(
		task: Task,
		packageName: string,
	) {
		const fetchPackage = await task(
			packageName,
			async ({ task, setStatus, setWarning }) => {
				setStatus('Fetching package info');
				const packageInfo = await getPackageInfo(this.got, packageName).catch((error) => {
					if (error.code === 'ERR_NON_2XX_3XX_RESPONSE') {
						return null;
					}

					throw error;
				});

				if (!packageInfo) {
					logger.info(this.id, 'Package not found', packageName);
					delete this.meta.packages[packageName];
					return;
				}

				const unpublishedVersions = Object.keys(this.meta.packages[packageName]);

				for (const version of Object.keys(packageInfo.versions)) {
					const index = unpublishedVersions.indexOf(version);
					if (index > -1) {
						unpublishedVersions.splice(index, 1);
					}

					if (!hasOwn(this.meta.packages[packageName], version)) {
						this.meta.packages[packageName][version] = null;
					}
				}

				for (const version of unpublishedVersions) {
					this.meta.packages[packageName][version] = null;
				}

				setStatus('Fetching tarballs');
				await pMap(
					Object.entries(packageInfo.versions),
					async ([version, dist]) => {
						const downloadTarball = await this.downloadPackageTarball(
							task,
							packageName,
							version,
							dist,
						);

						if (downloadTarball && downloadTarball.state !== 'success') {
							setWarning('Some downloads have failed');
						}
					},
					{
						concurrency: 5,
						stopOnError: false,
					},
				);
			},
		);

		if (fetchPackage.state === 'success') {
			fetchPackage.clear();
		}

		return fetchPackage;
	}

	async downloadPackageTarball(
		task: Task,
		packageName: string,
		version: string,
		{ tarball: tarballUrl, shasum }: PackageInfo['versions'][string],
	) {
		const tarballName = path.join(packageName, `${version}-${shasum}.tgz`);
		const tarballPath = path.join(packagesDirectoryPath, tarballName);

		if (await exists(tarballPath)) {
			this.meta.packages[packageName][version] = tarballPath.replace(packagesDirectoryPath, '.');
			return;
		}

		const downloadTask = await task(`Downloading ${version}`, async ({ setError }) => {
			logger.info(this.id, 'Downloading', `${packageName}@${version}`, shasum);

			// Needs to be dirname in case of @org/package
			await fs.promises.mkdir(path.dirname(tarballPath), { recursive: true });

			const sha1 = await atomicDownload(
				this.got,
				tarballUrl.replace(this.registryOptions.url, ''),
				tarballPath,
			);

			if (sha1 === shasum) {
				logger.info(this.id, 'Downloaded', `${packageName}@${version}`);
				this.meta.packages[packageName][version] = tarballPath.replace(packagesDirectoryPath, '.');
			} else {
				setError('Asset integrity check failed. Removing asset.');
				fs.promises.unlink(tarballPath);
			}
		});

		if (downloadTask.state === 'success') {
			downloadTask.clear();
		}

		return downloadTask;
	}

	async publishTarball(
		task: Task,
		packageName: string,
		version: string,
		tarballPath: string,
	) {
		const publishTask = await task(`Publishing ${packageName}@${version}`, async () => {
			logger.info(this.id, 'Publishing', `${packageName}@${version}`);
			const versions = [
				version,
				...Object.keys(this.meta.packages[packageName] || {}),
			].sort(semver.rcompare);

			/**
			 * Tag defaults to 'latest', but we may be backfilling an old version.
			 * Only use 'latest' if its the latest version. Otherwise, use 'registry-sync'.
			 */
			const tag = versions[0] === version ? 'latest' : 'registry-sync';
			const tarball = await fs.promises.readFile(tarballPath);
			const relativeTarballPath = tarballPath.replace(packagesDirectoryPath, '.');

			try {
				await publish(
					{
						name: packageName,
						version,
					},
					tarball,
					{
						...this.npmrc,
						strictSSL: this.registryOptions.strictSSL,
						npmVersion: `${packageJson.name}@${packageJson.version}`,
						registry: this.registryOptions.url,
						defaultTag: tag,
					},
				);

				this.meta.packages[packageName][version] = relativeTarballPath;
			} catch (error) {
				const { code, body } = error as any;

				if (code) {
					logger.error(this.id, `Failed to publish ${packageName}@${version}`, code);

					if (code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
						return;
					}

					if (
						code === 'EPUBLISHCONFLICT'
						|| (
							code === 'E403'
							&& body?.reason?.startsWith('cannot modify pre-existing version:')
						)
					) {
						const packageInfo = await getPackageInfo(this.got, packageName).catch(() => null);

						if (packageInfo) {
							const packageMeta = packageInfo.versions[version];

							if (packageMeta) {
								if (tarballPath.endsWith(`-${packageMeta.shasum}.tgz`)) {
									this.meta.packages[packageName][version] = relativeTarballPath;
								} else {
									this.meta.packages[packageName][version] = packageMeta;
								}
								return;
							}
						}
					}

					this.meta.packages[packageName][version] = code;
				}
			}
		});

		if (publishTask.state === 'success') {
			publishTask.clear();
		}

		return publishTask;
	}
}

export default Registry;
