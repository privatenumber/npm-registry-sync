import path from 'path';
import fs from 'fs/promises';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { execaNode } from 'execa';
import { startVerdaccio } from '../utils/setup-registry';
import { npmPublish } from '../utils/npm';
import { sha256 } from '../utils/hash';

const testPackageName = 'random-test-package-1234567890';

export default testSuite(async ({ test }) => {
	const fixture = await createFixture();

	const [serverA, serverB] = await Promise.all([
		startVerdaccio(fixture),
		startVerdaccio(fixture),
	]);

	const tarballPath = path.resolve('tests/fixtures/random-test-package-1234567890-0.0.0.tgz');

	await npmPublish(
		tarballPath,
		path.join(fixture.path, '.npmrc'),
		`http://localhost:${serverA.port}`,
	);

	await test('syncs package', async () => {
		await fixture.writeJson('npm-registry-sync.config.json', {
			registries: {
				verdaccioA: {
					name: `Verdaccio ${serverA.port}`,
					url: `http://localhost:${serverA.port}/`,
					strictSSL: false,
					npmrc: '.npmrc',
					packages: [testPackageName],
				},
				verdaccioB: {
					name: `Verdaccio ${serverB.port}`,
					url: `http://localhost:${serverB.port}/`,
					strictSSL: false,
					npmrc: '.npmrc',
				},
			},
			pollingInterval: 1,
		});

		const npmRegistriesSync = execaNode(path.resolve('dist/cli.js'), {
			cwd: fixture.path,
			env: {},
			extendEnv: false,
		});

		const logs = [
			`${serverB.port} [Publishing missing packages]`,
			`${serverB.port} [Polled at`,
		];

		await new Promise<void>((resolve, reject) => {
			npmRegistriesSync.catch(reject);

			npmRegistriesSync.stdout?.on('data', (chunk) => {
				if (chunk.toString().includes(logs[0])) {
					logs.shift();
				}

				if (logs.length === 0) {
					resolve();
				}
			});
		});

		npmRegistriesSync.kill();

		const npmRegistriesSyncAsset = await fixture.readFile(
			`data/packages/${testPackageName}/0.0.0-c67bb549fe80344a7a750a20d5ef684f881f7d25.tgz`,
		);

		const serverAAsset = await fixture.readFile(
			`verdaccio-storage-${serverA.port}/${testPackageName}/${testPackageName}-0.0.0.tgz`,
		);

		const serverBAsset = await fixture.readFile(
			`verdaccio-storage-${serverB.port}/${testPackageName}/${testPackageName}-0.0.0.tgz`,
		);

		const expectedHash = sha256(await fs.readFile(tarballPath));

		expect(sha256(npmRegistriesSyncAsset)).toBe(expectedHash);
		expect(sha256(serverAAsset)).toBe(expectedHash);
		expect(sha256(serverBAsset)).toBe(expectedHash);
	});

	await test('existing package versions should get fetched', async () => {
		await fixture.writeJson('npm-registry-sync.config.json', {
			registries: {
				verdaccioA: {
					name: `Verdaccio ${serverA.port}`,
					url: `http://localhost:${serverA.port}/`,
					strictSSL: false,
					npmrc: '.npmrc',
					packages: ['test-package'],
				},
				verdaccioB: {
					name: `Verdaccio ${serverB.port}`,
					url: `http://localhost:${serverB.port}/`,
					strictSSL: false,
					npmrc: '.npmrc',
				},
			},
			pollingInterval: 1,
		});

		const npmRegistriesSync = execaNode(path.resolve('dist/cli.js'), {
			cwd: fixture.path,
			env: {},
			extendEnv: false,
		});

		const logs = [
			`${serverB.port} [Publishing missing packages]`,
			`${serverB.port} [Polled at`,
		];

		await new Promise<void>((resolve, reject) => {
			npmRegistriesSync.catch(reject);

			npmRegistriesSync.stdout?.on('data', (chunk) => {
				if (chunk.toString().includes(logs[0])) {
					logs.shift();
				}

				if (logs.length === 0) {
					resolve();
				}
			});
		});

		npmRegistriesSync.kill();

		const [verdaccioAData, verdaccioBData] = await Promise.all([
			fixture.readFile('data/verdaccioA.json', 'utf8'),
			fixture.readFile('data/verdaccioB.json', 'utf8'),
		]);

		const verdaccioAJson = JSON.parse(verdaccioAData.toString());
		const verdaccioBJson = JSON.parse(verdaccioBData.toString());

		expect(verdaccioBJson.packages['test-package']).toStrictEqual(
			verdaccioAJson.packages['test-package'],
		);
	});

	serverA.process.kill();
	serverB.process.kill();

	await fixture.rm();
});
