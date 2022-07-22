import path from 'path';
import fs from 'fs/promises';
import { fork, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { type FsFixture } from 'fs-fixture';
import YAML from 'yaml';

const require = createRequire(import.meta.url);

function verdaccio(
	args: string[] = [],
): Promise<ChildProcess> {
	const verdaccioProcess = fork(
		require.resolve('verdaccio/bin/verdaccio'),
		args,
	);

	return new Promise((resolve, reject) => {
		verdaccioProcess.on('message', (message: {verdaccio_started: boolean}) => {
			if (message.verdaccio_started) {
				resolve(verdaccioProcess);
			}
		});

		verdaccioProcess.on('error', error => reject(error));
		verdaccioProcess.on('disconnect', error => reject(error));
	});
}

const verdaccioConfig = (storagePath: string) => ({
	storage: storagePath,
	uplinks: {
		npmjs: {
			url: 'https://registry.npmjs.org/',
		},
	},
	packages: {
		'@*/*': {
			access: '$all',
			publish: '$all',
			proxy: 'npmjs',
		},
		'**': {
			access: '$all',
			publish: '$all',
			proxy: 'npmjs',
		},
	},
	logs: {
		type: 'stdout',
		format: 'pretty',
		level: 'error',
	},
});

let trackPorts = 4873;

export async function startVerdaccio(
	fixture: FsFixture,
) {
	const serverPort = trackPorts;
	trackPorts += 1;

	const config = verdaccioConfig(`./verdaccio-storage-${serverPort}`);
	const configFilePath = `verdaccio-config-${serverPort}.yaml`;
	await fixture.writeFile(
		configFilePath,
		YAML.stringify(config),
	);

	await fs.appendFile(
		path.join(fixture.path, '.npmrc'),
		`//localhost:${serverPort}/:_authToken=anonymousAuthentication\n`,
	);

	const verdaccioProcess = await verdaccio([
		'--listen',
		serverPort.toString(),
		'--config',
		path.join(fixture.path, configFilePath),
	]);

	return {
		process: verdaccioProcess,
		port: serverPort,
	};
}
