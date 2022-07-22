import crypto from 'crypto';

export const sha256 = (file: string | Buffer) => {
	const hashSum = crypto.createHash('sha256');
	hashSum.update(file);
	return hashSum.digest('hex');
};
