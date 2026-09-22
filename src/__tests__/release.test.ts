import { describe, expect, it, vi } from 'vitest';
import {
  integrity, validateTag, validatePackage, verifyCandidate, verifyPack,
  verifyPublished, publishedState, publishEnvironment,
} from '../../scripts/release.mjs';

const pkg = {
  name: 'sql-workbench-embedded', version: '0.2.0',
  main: 'dist/sql-workbench-embedded.js', module: 'dist/sql-workbench-embedded.esm.js', types: 'dist/index.d.ts',
  repository: { url: 'git+https://github.com/tobilg/sql-workbench-embedded.git' },
};
const bytes = Buffer.from('verified tarball');
const candidate = { name: pkg.name, version: pkg.version, filename: `${pkg.name}-${pkg.version}.tgz`, integrity: integrity(bytes) };
const published = { name: pkg.name, version: pkg.version, dist: { integrity: candidate.integrity } };
const oidc = {
  GITHUB_ACTIONS: 'true', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'never-log-this',
  GITHUB_REPOSITORY: 'tobilg/sql-workbench-embedded', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v0.2.0',
  GITHUB_WORKFLOW_REF: 'tobilg/sql-workbench-embedded/.github/workflows/release.yml@refs/tags/v0.2.0',
};

describe('release validation', () => {
  it('accepts a stable tag matching the package version', () => {
    expect(validateTag('v0.2.0', '0.2.0')).toBe('0.2.0');
  });

  it.each(['0.2.0', 'v0.2', 'v00.2.0', 'v0.2.0-beta.1', 'v0.2.0+build', 'v0.2.1', 'v0.2.0\n'])('rejects an invalid or mismatched tag: %j', tag => {
    expect(() => validateTag(tag, pkg.version)).toThrow();
  });

  it('requires package and lockfile versions to agree', () => {
    const lock = { name: pkg.name, version: pkg.version, packages: { '': { name: pkg.name, version: pkg.version } } };
    expect(() => validatePackage(pkg, lock)).not.toThrow();
    expect(() => validatePackage(pkg, { ...lock, version: '0.1.5' })).toThrow('package-lock.json');
    expect(() => validatePackage(pkg, { ...lock, packages: { '': { ...pkg, version: '0.1.5' } } })).toThrow('package-lock.json');
    expect(() => validatePackage({ ...pkg, private: true }, lock)).toThrow('private');
    expect(() => validatePackage({ ...pkg, version: '0.2.0\n' }, lock)).toThrow();
  });

  it('checks both the release identity and tarball bytes', () => {
    expect(() => verifyCandidate(candidate, pkg, bytes)).not.toThrow();
    expect(() => verifyCandidate(candidate, pkg, Buffer.from('modified'))).toThrow('integrity');
    for (const field of ['name', 'version', 'filename', 'integrity']) {
      expect(() => verifyCandidate({ ...candidate, [field]: 'unexpected' }, pkg, bytes)).toThrow();
    }
  });

  it('requires the package entries and public declaration dependencies', () => {
    const files = [pkg.main, pkg.module, pkg.types, 'dist/embedded.d.ts', 'dist/types.d.ts', 'package.json', 'README.md', 'LICENSE'].map(path => ({ path }));
    const pack = { ...candidate, files };
    expect(() => verifyPack(pack, pkg, bytes)).not.toThrow();
    expect(() => verifyPack({ ...pack, files: files.filter(file => file.path !== 'dist/embedded.d.ts') }, pkg, bytes)).toThrow('missing dist/embedded.d.ts');
    expect(() => verifyPack({ ...pack, files: [...files, { path: '.npmrc' }] }, pkg, bytes)).toThrow('Unexpected release package file');
  });
});

describe('publication retries', () => {
  it('only accepts an identical existing package', () => {
    expect(() => verifyPublished(published, candidate)).not.toThrow();
    expect(() => verifyPublished({ ...published, dist: { integrity: 'other' } }, candidate)).toThrow('differs');
    expect(() => verifyPublished({ ...published, version: '0.1.5' }, candidate)).toThrow('differs');
    expect(() => verifyPublished({ ...published, name: 'other' }, candidate)).toThrow('differs');
  });

  it('publishes only when the registry explicitly returns 404', async () => {
    const request = vi.fn().mockResolvedValue({ status: 404, ok: false });
    await expect(publishedState(candidate, request)).resolves.toBe(false);
    expect(request).toHaveBeenCalledWith('https://registry.npmjs.org/sql-workbench-embedded/0.2.0', expect.objectContaining({ signal: expect.anything() }));
  });

  it('skips an identical published artifact', async () => {
    await expect(publishedState(candidate, async () => ({ ok: true, status: 200, json: async () => published }))).resolves.toBe(true);
  });

  it.each([401, 403, 429, 500])('fails closed on HTTP %s', async status => {
    await expect(publishedState(candidate, async () => ({ ok: false, status }))).rejects.toThrow(`HTTP ${status}`);
  });

  it('propagates network failures and rejects conflicting published bytes', async () => {
    await expect(publishedState(candidate, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    await expect(publishedState(candidate, async () => ({ ok: true, json: async () => ({ ...published, dist: {} }) }))).rejects.toThrow('differs');
  });
});

describe('npm trusted publisher context', () => {
  it('reports the exact public settings without exposing the token', () => {
    expect(publishEnvironment(pkg, oidc)).toEqual({
      package: pkg.name, repository: 'tobilg/sql-workbench-embedded', workflow: 'release.yml', environment: '(none)', allowedAction: 'npm publish',
    });
    expect(JSON.stringify(publishEnvironment(pkg, oidc))).not.toContain(oidc.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
  });

  it('rejects a missing OIDC grant', () => {
    expect(() => publishEnvironment(pkg, { ...oidc, ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' })).toThrow('OIDC');
  });

  it('rejects manual runs, branch pushes, mismatched tags, and another workflow', () => {
    expect(() => publishEnvironment(pkg, { ...oidc, GITHUB_EVENT_NAME: 'workflow_dispatch' })).toThrow('release tag');
    expect(() => publishEnvironment(pkg, { ...oidc, GITHUB_REF: 'refs/heads/main' })).toThrow('release tag');
    expect(() => publishEnvironment(pkg, { ...oidc, GITHUB_REF: 'refs/tags/v0.2.1' })).toThrow('release tag');
    expect(() => publishEnvironment(pkg, { ...oidc, GITHUB_WORKFLOW_REF: 'other/repo/.github/workflows/release.yml@refs/tags/v0.2.0' })).toThrow('release.yml');
    expect(() => publishEnvironment(pkg, { ...oidc, GITHUB_WORKFLOW_REF: 'tobilg/sql-workbench-embedded/.github/workflows/release.yml@refs/heads/main' })).toThrow('release.yml');
  });

  it('requires the package repository to match the publishing repository', () => {
    expect(() => publishEnvironment({ ...pkg, repository: { url: 'https://github.com/tobilg/other' } }, oidc)).toThrow('repository.url');
  });
});
