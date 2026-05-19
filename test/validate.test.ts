import { describe, expect, it } from 'vitest';
import type { CLIConfig, MenuNode } from '../src/types.js';
import { validateConfig } from '../src/validate/config.js';

function makeConfig(menu: readonly MenuNode[], extra: Partial<CLIConfig> = {}): CLIConfig {
  return { name: 'mycli', menu, ...extra };
}

const noop = () => undefined;

describe('validateConfig — happy path', () => {
  it('passes a valid flat menu', () => {
    const report = validateConfig(
      makeConfig([
        { label: 'Build', command: 'build', action: noop },
        { label: 'Test', command: 'test', action: noop },
      ]),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('passes a nested menu with submenus', () => {
    const report = validateConfig(
      makeConfig([
        {
          label: 'Tools',
          children: [
            { label: 'Lint', command: 'lint', action: noop },
            { label: 'Format', command: 'format', action: noop },
          ],
        },
      ]),
    );
    expect(report.errors).toEqual([]);
  });

  it('allows same command in different submenus (only siblings collide)', () => {
    const report = validateConfig(
      makeConfig([
        { label: 'A', children: [{ label: 'X', command: 'x', action: noop }] },
        { label: 'B', children: [{ label: 'X', command: 'x', action: noop }] },
      ]),
    );
    expect(report.errors).toEqual([]);
  });
});

describe('validateConfig — duplicate commands', () => {
  it('errors on duplicate command among siblings', () => {
    const report = validateConfig(
      makeConfig([
        { label: 'Build', command: 'build', action: noop },
        { label: 'Build again', command: 'build', action: noop },
      ]),
    );
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.code).toBe('duplicate_command');
    expect(report.errors[0]?.path).toEqual(['mycli', 'Build again'].slice(1));
  });
});

describe('validateConfig — empty children', () => {
  it('errors on a submenu with no children', () => {
    const report = validateConfig(
      makeConfig([{ label: 'Empty', children: [] }]),
    );
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.code).toBe('empty_children');
  });
});

describe('validateConfig — reserved commands', () => {
  it.each([['-h'], ['--help'], ['--version'], ['-v']])(
    'errors on reserved command "%s"',
    (cmd) => {
      const report = validateConfig(
        makeConfig([{ label: 'X', command: cmd, action: noop }]),
      );
      expect(report.errors[0]?.code).toBe('reserved_command');
    },
  );
});

describe('validateConfig — malformed nodes (defensive, via cast)', () => {
  it('errors when node has neither command+action nor children', () => {
    const malformed = { label: 'X' } as unknown as MenuNode;
    const report = validateConfig(makeConfig([malformed]));
    expect(report.errors[0]?.code).toBe('invalid_leaf');
  });

  it('errors when node has args but no action', () => {
    const malformed = {
      label: 'X',
      command: 'x',
      args: { foo: { type: 'boolean' } },
    } as unknown as MenuNode;
    const report = validateConfig(makeConfig([malformed]));
    expect(report.errors[0]?.code).toBe('args_without_action');
  });
});

describe('validateConfig — deep nesting warning', () => {
  it('warns when menu depth exceeds 8', () => {
    let menu: MenuNode[] = [{ label: 'leaf', command: 'leaf', action: noop }];
    for (let i = 0; i < 10; i++) {
      menu = [{ label: `level-${i}`, children: menu }];
    }
    const report = validateConfig(makeConfig(menu));
    expect(report.warnings.some((w) => w.code === 'deep_nesting')).toBe(true);
  });

  it('does not warn at depth 8 exactly', () => {
    let menu: MenuNode[] = [{ label: 'leaf', command: 'leaf', action: noop }];
    for (let i = 0; i < 7; i++) {
      menu = [{ label: `l${i}`, children: menu }];
    }
    const report = validateConfig(makeConfig(menu));
    expect(report.warnings).toEqual([]);
  });
});

describe('validateConfig — theme', () => {
  it('accepts valid named colors', () => {
    const report = validateConfig(
      makeConfig(
        [{ label: 'x', command: 'x', action: noop }],
        { theme: { colors: { primary: 'cyan', error: 'red' } } },
      ),
    );
    expect(report.errors).toEqual([]);
  });

  it('errors on invalid color name', () => {
    const bad = { theme: { colors: { primary: 'octarine' } } } as unknown as Partial<CLIConfig>;
    const report = validateConfig(
      makeConfig([{ label: 'x', command: 'x', action: noop }], bad),
    );
    expect(report.errors[0]?.code).toBe('invalid_color');
    expect(report.errors[0]?.path).toEqual(['theme', 'colors', 'primary']);
  });

  it('accepts Colorizer functions (skips name validation)', () => {
    const tint = (s: string) => `[${s}]`;
    const report = validateConfig(
      makeConfig(
        [{ label: 'x', command: 'x', action: noop }],
        { theme: { colors: { primary: tint } } },
      ),
    );
    expect(report.errors).toEqual([]);
  });

  it('accepts symbols up to 2 characters', () => {
    const report = validateConfig(
      makeConfig(
        [{ label: 'x', command: 'x', action: noop }],
        { theme: { symbols: { active: '▸', success: '✔ ' } } },
      ),
    );
    expect(report.errors).toEqual([]);
  });

  it('errors on symbol longer than 2 characters', () => {
    const report = validateConfig(
      makeConfig(
        [{ label: 'x', command: 'x', action: noop }],
        { theme: { symbols: { active: '>>>>' } } },
      ),
    );
    expect(report.errors[0]?.code).toBe('invalid_symbol');
  });
});
