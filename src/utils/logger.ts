import fs from 'fs';
import path from 'path';

const time = () => (new Date()).toLocaleString();

class Logger {
	infoLogFile: fs.WriteStream;

	errorLogFile: fs.WriteStream;

	constructor(directoryPath: string) {
		fs.mkdirSync('data/logs', { recursive: true });

		this.infoLogFile = fs.createWriteStream(
			path.join(directoryPath, 'data/logs/info.log'),
			{ flags: 'a' },
		);
		this.errorLogFile = fs.createWriteStream(
			path.join(directoryPath, 'data/logs/error.log'),
			{ flags: 'a' },
		);
	}

	info(...messages: string[]) {
		this.infoLogFile.write(`${time()} | ${messages.join(' - ')}\n`);
	}

	error(...messages: string[]) {
		this.errorLogFile.write(`${time()} | ${messages.join(' - ')}\n`);
	}
}

export default new Logger(process.cwd());
