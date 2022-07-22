import path from 'path';
import fs from 'fs/promises';
import { execa } from 'execa';

export async function npmPublish(
	tarballPath: string,
	npmrcPath: string,
	registryUrl: string,
) {
	const registryConfig = `registry=${registryUrl}\n`;
	await fs.appendFile(npmrcPath, registryConfig);

	const publishProcess = await execa(
		'npm',
		['publish', tarballPath],
		{
			cwd: path.dirname(npmrcPath),
		},
	);

	const npmrc = await fs.readFile(npmrcPath);
	await fs.writeFile(
		npmrcPath,
		npmrc.toString().replace(registryConfig, ''),
	);

	if (publishProcess.exitCode !== 0) {
		throw new Error(`npm publish failed${publishProcess.stderr.toString()}`);
	}
}
