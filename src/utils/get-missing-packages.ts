import chainset from 'chainset';
import type Registry from '../registry';
import type { PackagesManifest } from '../types';

/**
 * Given the current registry and an array of registries, it returns a manifest
 * of packages thare exist in other registries but not in the current one.
 */
export const getMissingPackages = (
	currentRegistry: Registry,
	registries: Registry[],
) => {
	const currentRegistryPackages = currentRegistry.meta!.packages;
	const missingPackages: PackagesManifest<string> = chainset();

	for (const registry of registries) {
		if (registry === currentRegistry) {
			continue;
		}

		const { packages } = registry.meta!;

		for (const [packageName, versions] of Object.entries(packages)) {
			const packageInRegistry = packageName in currentRegistryPackages;

			for (const [version, tarballPath] of Object.entries(versions)) {
				if (!(
					typeof tarballPath === 'string'
					&& tarballPath.startsWith('.')
				)) {
					continue;
				}

				const versionMissingFromCurrentRegistry = (
					!packageInRegistry
					|| !(version in currentRegistryPackages[packageName])
				);

				if (versionMissingFromCurrentRegistry) {
					missingPackages[packageName][version] = tarballPath;
				}
			}
		}
	}

	return missingPackages;
};
