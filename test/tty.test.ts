import { describe, expect, it } from 'vitest';
import type { CLIConfig, CliMode } from '../src/types.js';
import {
  detectMode,
  isInteractive,
  printPlainHelp,
  type InteractiveEnv,
  type TtyContext,
} from '../src/runtime/tty.js';

function makeEnv(
  stdinTty: boolean,
  stdoutTty: boolean,
  env: Record<string, string | undefined> = {},
): InteractiveEnv {
  return {
    stdin: { isTTY: stdinTty },
    stdout: { isTTY: stdoutTty },
    env,
  };
}

describe('isInteractive', () => {
  it('true when both stdin and stdout are TTYs and CI not set', () => {
    expect(isInteractive(makeEnv(true, true))).toBe(true);
  });

  it('false when stdin is not a TTY', () => {
    expect(isInteractive(makeEnv(false, true))).toBe(false);
  });

  it('false when stdout is not a TTY', () => {
    expect(isInteractive(makeEnv(true, false))).toBe(false);
  });

  it('false when CI=true even with TTYs', () => {
    expect(isInteractive(makeEnv(true, true, { CI: 'true' }))).toBe(false);
  });

  it('false when CI=1', () => {
    expect(isInteractive(makeEnv(true, true, { CI: '1' }))).toBe(false);
  });

  it('false when FORCE_NO_TTY=1', () => {
    expect(isInteractive(makeEnv(true, true, { FORCE_NO_TTY: '1' }))).toBe(false);
  });
});

function makeConfig(mode?: CliMode): CLIConfig {
  return {
    name: 'mycli',
    menu: [{ label: 'X', command: 'x', action: () => undefined }],
    ...(mode !== undefined ? { mode } : {}),
  };
}

function ttyCtx(interactive: boolean, hasArgv: boolean): TtyContext {
  return { interactive, hasArgv };
}

describe('detectMode — mode auto', () => {
  it('interactive → render-menu', () => {
    expect(detectMode(makeConfig('auto'), [], ttyCtx(true, false)).kind).toBe('render-menu');
  });

  it('non-interactive with argv → route-argv', () => {
    expect(detectMode(makeConfig('auto'), ['x'], ttyCtx(false, true)).kind).toBe('route-argv');
  });

  it('non-interactive without argv → print-help', () => {
    expect(detectMode(makeConfig('auto'), [], ttyCtx(false, false)).kind).toBe('print-help');
  });
});

describe('detectMode — mode interactive-only', () => {
  it('interactive → render-menu', () => {
    expect(detectMode(makeConfig('interactive-only'), [], ttyCtx(true, false)).kind).toBe(
      'render-menu',
    );
  });

  it('non-interactive → tty-required-error (with argv)', () => {
    expect(detectMode(makeConfig('interactive-only'), ['x'], ttyCtx(false, true)).kind).toBe(
      'tty-required-error',
    );
  });

  it('non-interactive → tty-required-error (without argv)', () => {
    expect(detectMode(makeConfig('interactive-only'), [], ttyCtx(false, false)).kind).toBe(
      'tty-required-error',
    );
  });
});

describe('detectMode — mode argv-only', () => {
  it('argv present → route-argv (even in TTY)', () => {
    expect(detectMode(makeConfig('argv-only'), ['x'], ttyCtx(true, true)).kind).toBe('route-argv');
  });

  it('no argv → print-help', () => {
    expect(detectMode(makeConfig('argv-only'), [], ttyCtx(true, false)).kind).toBe('print-help');
  });
});

describe('detectMode — default mode is auto', () => {
  it('no mode specified behaves as auto', () => {
    expect(detectMode(makeConfig(), [], ttyCtx(true, false)).kind).toBe('render-menu');
  });
});

describe('printPlainHelp', () => {
  function capture(): { write(chunk: string): void; output: () => string } {
    const chunks: string[] = [];
    return {
      write: (c) => chunks.push(c),
      output: () => chunks.join(''),
    };
  }

  it('prints usage and a flat list of commands', () => {
    const out = capture();
    printPlainHelp(
      'mycli',
      [
        { label: 'Build', command: 'build', action: () => undefined },
        { label: 'Test', command: 'test', action: () => undefined, hint: 'unit + e2e' },
      ],
      out,
    );
    const text = out.output();
    expect(text).toContain('Uso: mycli');
    expect(text).toContain('build');
    expect(text).toContain('Build');
    expect(text).toContain('test');
    expect(text).toContain('(unit + e2e)');
  });

  it('descends into submenus and prints all leaf commands', () => {
    const out = capture();
    printPlainHelp(
      'mycli',
      [
        {
          label: 'Settings',
          children: [
            { label: 'Edit', command: 'config:edit', action: () => undefined },
            { label: 'Reset', command: 'config:reset', action: () => undefined },
          ],
        },
      ],
      out,
    );
    const text = out.output();
    expect(text).toContain('config:edit');
    expect(text).toContain('config:reset');
  });

  it('shows fallback message for empty menu', () => {
    const out = capture();
    printPlainHelp('mycli', [], out);
    expect(out.output()).toContain('nenhum comando registrado');
  });
});
