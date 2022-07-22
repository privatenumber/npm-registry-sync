# npm-registry-sync

A daemon to sync packages across npm registries.

## About
`npm-registry-sync` is a daemon (background process) that synchronizes packages across multiple npm registries.

It's useful in scenarios where there are multiple private npm registries (eg. Enterprise [Artifactory](https://www.jfrog.com/confluence/display/JFROG/npm+Registry)) with different packages.

For example, given two private npm registries _A_ & _B_, where _A_ is currently reachable but _B_ is not (eg. behind firewall), `npm-registry-sync` will download all versions of the specified packages from _A_. When _B_ is finally reachable, it will publish all versions of the specified package to registry _B_.

## Usage

1. Setup a directory with a configuration file:

	`npm-registry-sync.config.json`:
	```json5
	{
	    "registries": {
	        "registry-id-a": {
	            "name": "Registry name A",
	            "url": "https://registry-url-a/",
	            "npmrc": "~/npmrc/file", // (Optional)
	            "strictSSL": false, // (Optional)

	            // These packages will be downloaded and published to the other registries
	            "packages": [
	                "package-name-a",
	                "package-name-b",
	                "package-name-c",
	                // ....
	            ]
	        },

	        "registry-id-b": {
	            "url": "https://registry-url-b/",
	            // ...
	        },
	        // ...
	    },

	    // Registry polling interval in seconds
	    "pollingInterval": 60
	}
	```

	> **Tip:** Use [npmrc](https://www.npmjs.com/package/npmrc) to manage configurations for multiple npm registries.
	> 
	> You can then reference the appropriate configuration in `~/.npmrcs/`.

2. Make sure [npm is authenticated](https://docs.npmjs.com/cli/v8/commands/npm-whoami) to the registries:
	```sh
	npm whoami --registry <registry url>
	```

3. Start `npm-registries-sync`:
	```sh
	npx npm-registries-sync
	```

	Or run it in the background using [screen](https://linuxize.com/post/how-to-use-linux-screen/):

	```sh
	screen npx npm-registries-sync
	```

## Config schema
```ts
export type Config = {
    registries: Record<string, {

        // Name of the registry (used for logging)
        name: string

        // URL of the registry
        url: string

        // Optional `.npmrc` file
        // Compatible with https://www.npmjs.com/package/npmrc
        npmrc?: string

        // Whether to disable SSL when interacting with registry
        strictSSL?: boolean

        // Array of package names to download
        // and publish to other registries
        packages?: string[]
    }>

    // Frequency to poll the registries in seconds
    // Default: 60
    pollingInterval: number
}
```
