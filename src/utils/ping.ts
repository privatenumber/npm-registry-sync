import type { Got } from 'got';

export const ping = async (
	registryGot: Got,
) => await registryGot.head('', {
	retry: {
		limit: 0,
	},
}).then(
	() => true,
	() => false,
);
