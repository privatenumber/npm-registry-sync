type RemoteAsset = {
	tarball: string;
	shasum: string;
}

export type PackagesManifest<Version = string | null> = {
	[packageName: string]: {
		[version: string]: Version | RemoteAsset;
	};
};

export type RegistryMeta = {
	url: string;
	lastPolled?: number;
	lastPolledSuccess?: number;
	packages: PackagesManifest;
};
