import path from 'path';
import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { loadConfig } from '../../src/utils/config';

export default testSuite(async ({ describe }) => {
	describe('Config', async ({ describe, test }) => {
		describe('Error', ({ test }) => {
			test('config not found', async () => {
				await expect(
					loadConfig('./non-existent-path.json'),
				).rejects.toThrow('Config file not found in current directory: ./non-existent-path.json');
			});

			test('invalid json', async () => {
				const fixture = await createFixture({
					'config.json': 'invalid json',
				});
				await expect(loadConfig(path.join(fixture.path, 'config.json'))).rejects.toThrow('Error parsing config file:');
			});

			test('no registries', async () => {
				const fixture = await createFixture({
					'config.json': '{}',
				});

				await expect(loadConfig(path.join(fixture.path, 'config.json'))).rejects.toThrow('Config must have a `registries` object property');
			});

			test('duplicated urls across registries', async () => {
				const fixture = await createFixture({
					'config.json': JSON.stringify({
						registries: {
							'registry-a': {
								name: 'Registry A',
								url: 'https://some-registry/',
							},
							'registry-b': {
								name: 'Registry B',
								url: 'https://some-registry/',
							},
						},
						pollingInterval: 60_000,
					}),
				});

				await expect(loadConfig(path.join(fixture.path, 'config.json'))).rejects.toThrow('Multiple registries found for url "https://some-registry/": Registry A, Registry B');
			});

			test('duplicated package across registries', async () => {
				const fixture = await createFixture({
					'config.json': JSON.stringify({
						registries: {
							'registry-a': {
								name: 'Registry A',
								url: 'https://some-registry/',
								packages: [
									'some-package',
								],
							},
							'registry-b': {
								name: 'Registry B',
								url: 'https://some-registry/',
								packages: [
									'some-package',
								],
							},
						},
						pollingInterval: 60_000,
					}),
				});

				await expect(loadConfig(path.join(fixture.path, 'config.json'))).rejects.toThrow('Multiple registry sources found for package "some-package": Registry A, Registry B');
			});
		});

		test('parses config', async () => {
			const fixture = await createFixture({
				'config.json': `
				{
					// comments are allowed
					"registries": {
						"registry": {
							"name": "Registry",
							"url": "http://some-registry/",
							"packages": [
								"some-package-c"
							]
						}
					},
					"pollingInterval": 60000, // dangling commas allowed
				}
				`,
			});

			const config = await loadConfig(path.join(fixture.path, 'config.json'));
			expect(config).toEqual({
				pollingInterval: 60_000,
				registries: {
					registry: {
						name: 'Registry',
						url: 'http://some-registry/',
						packages: ['some-package-c'],
					},
				},
			});
		});
	});
});
