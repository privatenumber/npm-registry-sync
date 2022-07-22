export type PackagesManifest<Version = string | null> = {
	[packageName: string]: {
		[version: string]: Version;
	};
};

export type RegistryMeta = {
	url: string;
	lastPolled?: number;
	lastPolledSuccess?: number;
	packages: PackagesManifest;
};
