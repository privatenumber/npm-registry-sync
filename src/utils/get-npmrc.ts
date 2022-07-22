import fs from 'fs';
import os from 'os';
import rc from 'rc';
import { parse } from 'ini';

type Npmrc = {
	[key: string]: any;
};

const cache = new Map<string, Npmrc>();

export function getNpmrc(npmrcPath?: string) {
	if (npmrcPath && npmrcPath.startsWith('~')) {
		npmrcPath = os.homedir() + npmrcPath.slice(1);
	}

	const cacheKey = npmrcPath || 'default';
	let npmrc = cache.get(cacheKey);

	if (!npmrc) {
		if (npmrcPath) {
			const npmrcString = fs.readFileSync(npmrcPath, 'utf8');
			npmrc = parse(npmrcString);
		} else {
			npmrc = rc('npm');
		}
		cache.set(cacheKey, npmrc);
	}

	return npmrc;
}
