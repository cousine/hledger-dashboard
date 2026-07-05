import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const versions = JSON.parse(readFileSync(new URL('versions.json', root), 'utf8'));

let failed = false;

function error(msg) {
  console.error(`Error: ${msg}`);
  failed = true;
}

if (pkg.version !== manifest.version) {
  error(`package.json version is "${pkg.version}" but manifest.json version is "${manifest.version}"`);
}

if (!(manifest.version in versions)) {
  error(`versions.json is missing an entry for manifest version "${manifest.version}"`);
} else if (versions[manifest.version] !== manifest.minAppVersion) {
  error(
    `versions.json["${manifest.version}"] is "${versions[manifest.version]}"`
    + ` but manifest.json minAppVersion is "${manifest.minAppVersion}"`,
  );
}

const githubRef = process.env.GITHUB_REF;
if (githubRef?.startsWith('refs/tags/')) {
  const tag = githubRef.replace('refs/tags/', '');
  const tagVersion = tag.startsWith('v') ? tag.slice(1) : tag;
  if (tagVersion !== manifest.version) {
    error(`Git tag "${tag}" does not match manifest.json version "${manifest.version}"`);
  }
}

if (failed) process.exit(1);
