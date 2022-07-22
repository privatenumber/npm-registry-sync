import type { Got } from 'got';

export type PackageInfo = {
	name: string;
	versions: {
		[version: string]: {
			tarball: string;
			shasum: string;
		};
	};
}

type RawPackageInfo = {
	name: string;
	versions: Record<string, {
		dist: {
			tarball: string;
			shasum: string;
		};
	}>;
};

export async function getPackageInfo(
	registryGot: Got,
	packageName: string,
): Promise<PackageInfo> {
	const packageInfo = await registryGot(packageName).json() as RawPackageInfo;

	const packageVersions = Object.entries(packageInfo.versions).map(
		([version, { dist }]) => [version, dist] as const,
	);

	return {
		name: packageInfo.name,
		versions: Object.fromEntries(packageVersions),
	};
}
