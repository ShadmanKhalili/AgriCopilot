import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Netlify turns every top-level file in netlify/functions into a function,
 * and every subdirectory that holds an index.* or <dirname>.* file too.
 * A stray *.test.ts at the top level once broke a deploy. These checks guard
 * the shape of that folder without importing any function (imports can pull
 * in env vars or the network).
 */
const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..', '..');

const FUNCTION_EXTENSIONS = new Set(['.ts', '.js', '.mts', '.mjs']);
const ALLOWED_NON_FUNCTION_FILES = new Set(['README.md', '.gitkeep']);

const entries = readdirSync(FUNCTIONS_DIR).map((name) => ({
  name,
  isDir: statSync(path.join(FUNCTIONS_DIR, name)).isDirectory(),
}));
const topLevelFiles = entries.filter((e) => !e.isDir).map((e) => e.name);
const subDirs = entries.filter((e) => e.isDir).map((e) => e.name);
const functionFiles = topLevelFiles.filter((f) => FUNCTION_EXTENSIONS.has(path.extname(f)));

describe('netlify/functions surface', () => {
  it('has top-level function files', () => {
    expect(functionFiles.length).toBeGreaterThan(0);
  });

  it('has no test or spec files at the top level', () => {
    expect(topLevelFiles.filter((f) => /\.(test|spec)\./.test(f))).toEqual([]);
  });

  it('has no unexpected non-function files at the top level', () => {
    const odd = topLevelFiles.filter(
      (f) => !FUNCTION_EXTENSIONS.has(path.extname(f)) && !ALLOWED_NON_FUNCTION_FILES.has(f)
    );
    expect(odd).toEqual([]);
  });

  it('has no type declaration files at the top level', () => {
    expect(topLevelFiles.filter((f) => /\.d\.(ts|mts)$/.test(f))).toEqual([]);
  });

  it.each(functionFiles.filter((f) => /\.m?ts$/.test(f)))(
    '%s exports a handler or a default',
    (file) => {
      const source = readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8');
      const exportsHandler =
        /export\s+(?:async\s+)?(?:const|let|var|function)\s+handler\b/.test(source) ||
        /export\s*\{[^}]*\bhandler\b[^}]*\}/.test(source) ||
        /export\s+default\b/.test(source) ||
        /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(source);
      expect(exportsHandler, `${file} must export "handler" or a default function`).toBe(true);
    }
  );

  it('maps every netlify.toml function redirect target to a top-level file', () => {
    const toml = readFileSync(path.join(REPO_ROOT, 'netlify.toml'), 'utf8');
    const targets = new Set<string>();
    for (const match of toml.matchAll(/to\s*=\s*"\/\.netlify\/functions\/([^"]+)"/g)) {
      targets.add(match[1]);
    }
    expect(targets.size).toBeGreaterThan(0);
    const names = new Set(functionFiles.map((f) => f.replace(/\.[^.]+$/, '')));
    const missing = [...targets]
      // ":splat" is the catch-all; it resolves to whichever function the URL names.
      .filter((t) => !t.startsWith(':'))
      .filter((t) => !names.has(t));
    expect(missing).toEqual([]);
  });

  it.each(subDirs)('subdirectory %s is not treated as a function', (dir) => {
    const inner = readdirSync(path.join(FUNCTIONS_DIR, dir));
    const offending = inner.filter((f) => {
      const base = f.replace(/\.[^.]+$/, '');
      return base === 'index' || base === dir;
    });
    expect(offending, `${dir}/ must not hold index.* or ${dir}.*`).toEqual([]);
  });
});
