import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (...args: string[]) => spawnSync('node', args, { encoding: 'utf8' });

describe('cli', () => {
  it('csv-to-json prints a valid catalog', () => {
    const r = run('scripts/csv-to-json.ts', 'tests/fixtures/ok.csv');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).offers[0].url).toBe('https://acme.test/p1');
  });
  it('validate exits non-zero with errors on stderr', () => {
    const r = run('scripts/validate.ts', 'tests/fixtures/bad.json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('unknown product');
  });
  it('validate passes a good file', () => {
    run('scripts/csv-to-json.ts', 'tests/fixtures/ok.csv');
    const r = run('scripts/validate.ts', 'demo/catalog.json');
    expect(r.status, r.stderr).toBe(0);
  });
});
