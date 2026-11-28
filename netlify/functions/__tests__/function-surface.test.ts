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

  it('gives no v2 function with a custom path a matching netlify.toml redirect', () => {
    // A redirect and a function `path` for the same route conflict; a v2
    // function with a custom path is also not reachable at /.netlify/functions/<name>,
    // so a redirect to it would point nowhere.
    const toml = readFileSync(path.join(REPO_ROOT, 'netlify.toml'), 'utf8');
    const redirectFroms = new Set<string>();
    for (const match of toml.matchAll(/from\s*=\s*"([^"]+)"/g)) redirectFroms.add(match[1]);
    const redirectTargets = new Set<string>();
    for (const match of toml.matchAll(/to\s*=\s*"\/\.netlify\/functions\/([^"]+)"/g)) {
      redirectTargets.add(match[1]);
    }

    const customPaths: Array<{ file: string; route: string }> = [];
    for (const file of functionFiles.filter((f) => /\.m?ts$/.test(f))) {
      const source = readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8');
      const route = /export\s+const\s+config\b[^=]*=\s*\{[^}]*?\bpath:\s*'([^']+)'/s.exec(source)?.[1];
      if (route) customPaths.push({ file, route });
    }
    expect(customPaths.length).toBeGreaterThan(0);
    for (const { file, route } of customPaths) {
      expect(route.startsWith('/api/'), `${file} path ${route} must be under /api/`).toBe(true);
      expect(redirectFroms.has(route), `${file}: remove the netlify.toml redirect for ${route}`).toBe(false);
      const name = file.replace(/\.[^.]+$/, '');
      expect(redirectTargets.has(name), `${file}: a redirect targets /.netlify/functions/${name}`).toBe(false);
    }
  });

  it('keeps the unauthenticated data proxies on a rate-limited custom path', () => {
    const proxies = [
      'daily-forecast',
      'historical-data',
      'loc-lookup',
      'wb-indicators',
      'soil-properties',
      'sentinel',
      'config-status',
    ];
    for (const name of proxies) {
      const source = readFileSync(path.join(FUNCTIONS_DIR, `${name}.ts`), 'utf8');
      expect(source, `${name} must declare path /api/${name}`).toContain(`path: '/api/${name}'`);
      expect(source, `${name} must declare a rateLimit`).toMatch(/rateLimit:\s*\{/);
      expect(source, `${name} must not send a CORS header`).not.toMatch(/Access-Control-Allow-Origin/i);
    }
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
