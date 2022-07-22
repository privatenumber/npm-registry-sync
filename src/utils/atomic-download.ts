import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { promisify } from 'util';
import stream from 'stream';
import type { Got } from 'got';

const pipeline = promisify(stream.pipeline);

const temporaryDirectory = path.join(os.tmpdir(), 'npm-registries-sync');

function getSha1(
	downloadStream: NodeJS.ReadableStream,
): Promise<string> {
	return new Promise((resolve) => {
		const hash = crypto.createHash('sha1');
		downloadStream.pipe(hash);
		downloadStream.on('end', () => resolve(hash.digest('hex')));
	});
}

export async function atomicDownload(
	registryGot: Got,
	urlPath: string,
	downloadTo: string,
) {
	if (urlPath.startsWith('/')) {
		urlPath = urlPath.slice(1);
	}

	// Write to temp path and move it because quitting process before finish can corrupt it
	const filename = urlPath.replace(/\/+/g, '!');
	const temporaryLocation = path.join(temporaryDirectory, filename);

	await fs.promises.mkdir(path.dirname(temporaryLocation), { recursive: true });

	// The benefit of a stream based download is that it keeps the buffer out of memory
	// in case there are many large downloads happening at once
	const downloadStream = registryGot.stream(urlPath);

	downloadStream.on('error', (error) => {
		console.log('Error downloading', urlPath, error);
	});

	const sha1 = getSha1(downloadStream);

	await pipeline(
		downloadStream,
		fs.createWriteStream(temporaryLocation),
	);

	await fs.promises.rename(temporaryLocation, downloadTo);

	return await sha1;
}
