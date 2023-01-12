# GitHub Issue Migration tool

This tool uses the GitHub issue transfer functionality to transfer issues between two repositories.
Unfortunately, GitHub does not provide an API for this functionality. This script uses a headless Chrome browser instead to perform the transfer through the normal web interface.

Note: All of this is ugly code "to get the thing done". Try it extensively
before using it on valuable repositories.

## Installation

### Prepare your node.js environment

* NodeJS 12
* Yarn

For openSUSE:

```sh
zypper in nodejs
# there's no yarn package
curl -o- -L https://yarnpkg.com/install.sh | bash
```

### Install dependencies

```sh
yarn install
```

## Usage

1. Prepare a `settings.json` file. Copy over the `settings.json.dist` file, and adjust it as needed.

2. Run the script:

   ```sh
   ./github-issue-transfer.js
   ```

## License

Apache 2
