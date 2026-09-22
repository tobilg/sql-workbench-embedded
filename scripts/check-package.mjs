import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tarball = process.argv[2];
if (!tarball) throw new Error('Usage: node scripts/check-package.mjs PATH_TO_TARBALL');
const temporary = await mkdtemp(path.join(tmpdir(), 'sql-workbench-package-'));

try {
  const installed = path.join(temporary, 'node_modules/sql-workbench-embedded');
  await mkdir(installed, { recursive: true });
  execFileSync('tar', ['-xzf', path.resolve(tarball), '--strip-components=1', '-C', installed]);
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  if (pkg.name !== 'sql-workbench-embedded') throw new Error('Unexpected package in release tarball.');
  for (const entry of [pkg.main, pkg.module, pkg.types]) {
    if (!(await readFile(path.join(installed, entry))).length) throw new Error(`Empty package entry: ${entry}`);
  }

  // A consumer has no optional DuckDB peer installed. All public types must still resolve.
  const namedImports = `import { SQLWorkbench, Embedded, type SQLWorkbenchConfig, type EmbeddedOptions, type QueryResult } from 'sql-workbench-embedded';`;
  const usage = `
const config: SQLWorkbenchConfig = { autoInit: false, initQueries: ['SELECT 1'], theme: 'light' };
const options: EmbeddedOptions = { initialCode: 'SELECT 1', editable: true };
SQLWorkbench.config(config);
const embed = new Embedded(document.createElement('pre'), options);
const container: HTMLElement | null = embed.getContainer();
const execution: Promise<void> = embed.run();
const shutdown: Promise<void> = SQLWorkbench.destroy();
const result: QueryResult = { columns: ['value'], rows: [[1]], rowCount: 1, executionTime: 0 };
// @ts-expect-error editable must be a boolean; also detects missing/untyped declarations
SQLWorkbench.config({ editable: 'yes' });
void [container, execution, shutdown, result];
`;
  await writeFile(path.join(temporary, 'consumer.mts'), namedImports + usage);
  await writeFile(path.join(temporary, 'consumer.cts'), namedImports + usage);
  await writeFile(path.join(temporary, 'bundler.ts'), namedImports + usage + `
import defaultWorkbench from 'sql-workbench-embedded';
defaultWorkbench.config({ autoInit: false });
`);
  for (const [moduleResolution, module, files] of [
    ['NodeNext', 'NodeNext', ['consumer.mts', 'consumer.cts']],
    ['Bundler', 'ESNext', ['bundler.ts']],
  ]) {
    const tsconfig = path.join(temporary, 'tsconfig.json');
    await writeFile(tsconfig, JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, target: 'ES2020', lib: ['ES2020', 'DOM'], module, moduleResolution, types: [], skipLibCheck: false },
      files,
    }));
    execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', tsconfig], { stdio: 'inherit' });
    console.log(`Packed consumer types passed: ${moduleResolution}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
