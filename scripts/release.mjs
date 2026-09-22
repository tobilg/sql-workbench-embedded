import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageName = 'sql-workbench-embedded';

export function validateTag(tag, version) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag) || tag !== tag.trim()) {
    throw new Error('Release tag must be stable vMAJOR.MINOR.PATCH.');
  }
  if (tag !== `v${version}`) throw new Error(`Tag ${tag} does not match package version ${version}.`);
  return version;
}

export function validatePackage(pkg, lock) {
  validateTag(`v${pkg.version}`, pkg.version);
  if (pkg.name !== packageName || pkg.private) throw new Error('Unexpected or private release package.');
  if (lock.name !== pkg.name || lock.version !== pkg.version ||
      lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('package-lock.json must match the package name and version.');
  }
}

export const integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export function verifyCandidate(candidate, pkg, bytes) {
  if (candidate.name !== pkg.name || candidate.version !== pkg.version ||
      candidate.filename !== `${pkg.name}-${pkg.version}.tgz` || candidate.integrity !== integrity(bytes)) {
    throw new Error('Release tarball identity or integrity mismatch.');
  }
}

export function verifyPack(pack, pkg, bytes) {
  verifyCandidate(pack, pkg, bytes);
  const files = new Set(pack.files?.map(file => file.path));
  for (const required of [pkg.main, pkg.module, pkg.types, 'dist/embedded.d.ts', 'dist/types.d.ts', 'package.json', 'README.md', 'LICENSE']) {
    if (!files.has(required)) throw new Error(`Release package is missing ${required}.`);
  }
  for (const file of files) {
    if (!/^(package\.json|README\.md|LICENSE|dist\/[^/]+\.(js|d\.ts))$/.test(file)) {
      throw new Error(`Unexpected release package file: ${file}`);
    }
  }
}

export function verifyPublished(metadata, expected) {
  if (metadata.name !== expected.name || metadata.version !== expected.version || metadata.dist?.integrity !== expected.integrity) {
    throw new Error('Published package differs from the verified artifact; refusing to overwrite or skip it.');
  }
}

export async function publishedState(expected, fetcher = fetch) {
  const response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(expected.name)}/${encodeURIComponent(expected.version)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Cannot verify npm publication: HTTP ${response.status}.`);
  verifyPublished(await response.json(), expected);
  return true;
}

export function publishEnvironment(pkg, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || !env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    throw new Error('GitHub OIDC is unavailable. Publish from GitHub Actions with id-token: write.');
  }
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== `refs/tags/v${pkg.version}`) {
    throw new Error('Publication requires a push of the matching release tag.');
  }
  validateTag(`v${pkg.version}`, pkg.version);
  const repository = env.GITHUB_REPOSITORY;
  const workflow = 'release.yml';
  if (!repository || env.GITHUB_WORKFLOW_REF !== `${repository}/.github/workflows/${workflow}@${env.GITHUB_REF}`) {
    throw new Error('Publication must run from this repository\'s release.yml workflow.');
  }
  const repositoryUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (repositoryUrl?.replace(/^git\+/, '').replace(/\.git$/, '') !== `https://github.com/${repository}`) {
    throw new Error(`package repository.url must match https://github.com/${repository} for npm provenance.`);
  }
  // These are public publisher settings; never log the OIDC request token.
  return { package: pkg.name, repository, workflow, environment: '(none)', allowedAction: 'npm publish' };
}

async function output(values) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
  console.log(JSON.stringify(values));
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const [command, argument] = process.argv.slice(2);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  validatePackage(pkg, lock);
  const directory = path.join(root, 'build/package');
  const filename = `${pkg.name}-${pkg.version}.tgz`;
  if (command === 'validate') {
    validateTag(argument || `v${pkg.version}`, pkg.version);
    await output({ version: pkg.version });
  } else if (command === 'candidate') {
    const packs = JSON.parse(await readFile(path.join(directory, 'pack.json'), 'utf8'));
    if (packs.length !== 1) throw new Error('Expected exactly one packed package.');
    const bytes = await readFile(path.join(directory, filename));
    verifyPack(packs[0], pkg, bytes);
    const candidate = { name: pkg.name, version: pkg.version, filename, integrity: integrity(bytes) };
    await writeFile(path.join(directory, 'release.json'), JSON.stringify(candidate, null, 2) + '\n');
    await output({ version: pkg.version, tarball: filename });
  } else if (command === 'published') {
    const candidate = JSON.parse(await readFile(path.join(directory, 'release.json'), 'utf8'));
    verifyCandidate(candidate, pkg, await readFile(path.join(directory, filename)));
    await output({ published: await publishedState(candidate) });
  } else if (command === 'publish-environment') {
    console.log(`Required npm trusted publisher: ${JSON.stringify(publishEnvironment(pkg))}`);
    console.log('For ENEEDAUTH, check these exact settings on npm, including permission for direct npm publish.');
  } else {
    throw new Error('Usage: node scripts/release.mjs validate [vX.Y.Z] | candidate | published | publish-environment');
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
