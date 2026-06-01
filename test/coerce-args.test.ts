import { describe, expect, it } from 'vitest';
import type { ArgsSchema } from '../src/types.js';
import { coerceArgsAgainstSchema } from '../src/runtime/coerce-args.js';

describe('coerceArgsAgainstSchema — declared args', () => {
  const schema: ArgsSchema = {
    file: { type: 'string', required: true },
    format: { type: 'enum', options: ['json', 'yaml'], required: true },
    watch: { type: 'boolean' },
    region: { type: 'string', default: 'us' },
  };

  it('coerces string, enum, boolean and applies string default', () => {
    const r = coerceArgsAgainstSchema(schema, ['conv', '--file', 'a.txt', '--format', 'json', '--watch'], {
      dropPositionals: 1,
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.args).toEqual({ file: 'a.txt', format: 'json', watch: true, region: 'us' });
  });

  it('errors when a required arg is missing', () => {
    const r = coerceArgsAgainstSchema(schema, ['conv', '--format', 'json']);
    expect(r.kind).toBe('arg-error');
    if (r.kind === 'arg-error') expect(r.argName).toBe('file');
  });

  it('errors on an invalid enum value', () => {
    const r = coerceArgsAgainstSchema(schema, ['conv', '--file', 'a', '--format', 'toml']);
    expect(r.kind).toBe('arg-error');
    if (r.kind === 'arg-error') expect(r.argName).toBe('format');
  });
});

describe('coerceArgsAgainstSchema — strict / rest / positionals', () => {
  const schema: ArgsSchema = { path: { type: 'string' } };

  it('rejects undeclared flags when strict (default)', () => {
    const r = coerceArgsAgainstSchema(schema, ['zip', '--verbose']);
    expect(r.kind).toBe('arg-error');
    if (r.kind === 'arg-error') {
      expect(r.argName).toBe('verbose');
      expect(r.reason).toContain('Flag desconhecida');
    }
  });

  it('collects undeclared flags into rest when strict:false', () => {
    const r = coerceArgsAgainstSchema(schema, ['zip', '--path', 'x', '--verbose', '--n', '3'], {
      strict: false,
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.args).toEqual({ path: 'x' });
    expect(r.rest).toEqual({ verbose: true, n: 3 });
  });

  it('exposes positionals, dropping the command token', () => {
    const r = coerceArgsAgainstSchema(schema, ['zip', 'Ingram/330', 'extra'], {
      strict: false,
      dropPositionals: 1,
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.positionals).toEqual(['Ingram/330', 'extra']);
  });

  it('keeps all positionals when dropPositionals is 0', () => {
    const r = coerceArgsAgainstSchema(schema, ['a', 'b'], { strict: false });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.positionals).toEqual(['a', 'b']);
  });
});
