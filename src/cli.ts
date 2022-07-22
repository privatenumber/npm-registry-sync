import { cli } from 'cleye';
import { version, description } from '../package.json';
import { loadConfig } from './utils/config';
import logger from './utils/logger';
import Registry from './registry';

const argv = cli({
	name: 'npm-registries-sync',

	version,

	flags: {
		dry: {
			type: Boolean,
			description: 'Time of day to greet (morning or evening)',
		},

		config: {
			type: String,
			description: 'Path to config file',
			alias: 'c',
			default: 'npm-registry-sync.config.json',
		},
	},

	help: {
		description,
	},
});

(async () => {
	logger.info('Starting up');
	const config = await loadConfig(argv.flags.config);

	const registries = Object.entries(config.registries).map(
		([registryId, registry]) => new Registry(registryId, registry),
	);

	for (const registry of registries) {
		registry.fetch(registries, config.pollingInterval);
	}
})();
