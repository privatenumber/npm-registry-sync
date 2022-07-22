import assert from 'assert';
import fs from 'fs/promises';
import exists from 'fs.promises.exists';
import { parse } from 'jsonc-parser';
import { hasOwn } from './has-own';

export type RegistryOptions = {
	name: string;
	url: string;
	strictSSL?: boolean;
	npmrc?: string;
	packages?: string[];
};

export type Config = {
	/**
	 * Object of registry names to registry options
	 */
	registries: Record<string, RegistryOptions>;

	/**
	 * The interval in seconds between polling for new packages
	 */
	pollingInterval: number;
};

function validateConfig(config: Config) {
	if (!('pollingInterval' in config)) {
		config.pollingInterval = 60;
	}

	const { registries } = config;

	if (!registries || typeof registries !== 'object') {
		throw new Error('Config must have a `registries` object property');
	}

	const packages: Record<string, string> = {};
	const urls: Record<string, string> = {};

	for (const registryName in registries) {
		if (!hasOwn(registries, registryName)) {
			continue;
		}

		const registry = registries[registryName];

		if (registry.packages) {
			for (const packageName of registry.packages) {
				assert(
					!(packageName in packages),
					`Multiple registry sources found for package "${packageName}": ${packages[packageName]}, ${registry.name}`,
				);

				packages[packageName] = registry.name;
			}
		}

		assert(
			!(registry.url in urls),
			`Multiple registries found for url "${registry.url}": ${urls[registry.url]}, ${registry.name}`,
		);

		urls[registry.url] = registry.name;
	}
}

export const loadConfig = async (
	configFilePath: string,
): Promise<Config> => {
	if (!await exists(configFilePath)) {
		throw new Error(`Config file not found in current directory: ${configFilePath}`);
	}

	const configString = await fs.readFile(configFilePath, 'utf8');

	const config = parse(configString) as Config;

	if (!config || typeof config !== 'object') {
		throw new Error(`Error parsing config file: ${configFilePath}`);
	}

	validateConfig(config);

	return config;
};
