import { describe } from 'manten';

describe('npm-registries-sync', async ({ runTestSuite }) => {
	runTestSuite(import('./specs/config.spec'));
	runTestSuite(import('./specs/publish.spec'));
});
