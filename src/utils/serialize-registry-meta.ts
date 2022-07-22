import semver from 'semver';
import type { RegistryMeta } from '../types';
import { sortObject } from './sort-object';
import { hasOwn } from './has-own';

const compareAlphabet = (a: string, b: string) => a.localeCompare(b);

export const serializeRegistryMeta = (data: RegistryMeta) => {
	const packages = sortObject(data.packages, compareAlphabet);

	for (const packageName in packages) {
		if (hasOwn(packages, packageName)) {
			packages[packageName] = sortObject(packages[packageName], semver.compare);
		}
	}

	return JSON.stringify({
		...data,
		packages,
	}, null, '\t');
};
