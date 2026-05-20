import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuNode } from '../src/types.js';

const cancelSym = Symbol.for('vereda.cancel');

const mocks = vi.hoisted(() => ({
  runMenuSelect: vi.fn(),
  isMenuCancel: vi.fn((v: unknown) => v === Symbol.for('vereda.cancel')),
  confirm: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn((v: unknown) => v === Symbol.for('vereda.cancel')),
}));

vi.mock('../src/renderer/menu-select.js', () => ({
  runMenuSelect: mocks.runMenuSelect,
  isMenuCancel: mocks.isMenuCancel,
}));

vi.mock('@clack/prompts', () => ({
  confirm: mocks.confirm,
  text: mocks.text,
  select: mocks.select,
  isCancel: mocks.isCancel,
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    error: vi.fn(),
  })),
}));

const { navigateMenu } = await import('../src/runtime/render-menu.js');
const { applyTheme } = await import('../src/theme/apply.js');

const baseTheme = applyTheme(undefined);

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if ('mockReset' in m) m.mockReset();
  });
  mocks.isMenuCancel.mockImplementation((v: unknown) => v === cancelSym);
  mocks.isCancel.mockImplementation((v: unknown) => v === cancelSym);
});

/**
 * Helper: queue picks for runMenuSelect. After the queue is empty, the mock
 * returns the menu's last option (which is Sair at root and Voltar in submenus),
 * so any test that doesn't explicitly exit still terminates.
 */
function queuePicks(...picks: unknown[]): void {
  const queue = [...picks];
  mocks.runMenuSelect.mockImplementation(
    ({ options }: { options: { value: unknown }[] }) => {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift());
      }
      // Default: pick the last option (Sair at root, Voltar in submenus).
      return Promise.resolve(options[options.length - 1]?.value);
    },
  );
}

describe('navigateMenu — one-shot mode (legacy: terminates after one action)', () => {
  it('runs the action when user picks a leaf', async () => {
    const action = vi.fn();
    const leaf: MenuNode = { label: 'Build', command: 'build', action };

    queuePicks(leaf);

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });

    expect(result).toEqual({ kind: 'completed', command: 'build' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('returns "exited" when user picks the Sair option', async () => {
    const leaf: MenuNode = { label: 'X', command: 'x', action: vi.fn() };
    queuePicks(); // no queue → default picks Sair
    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });
    expect(result).toEqual({ kind: 'exited' });
  });

  it('returns "cancelled" when user cancels at root', async () => {
    const leaf: MenuNode = { label: 'X', command: 'x', action: vi.fn() };
    queuePicks(cancelSym);
    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });
    expect(result).toEqual({ kind: 'cancelled' });
  });
});

describe('navigateMenu — submenu navigation', () => {
  it('descends into branch then runs the inner leaf', async () => {
    const innerAction = vi.fn();
    const innerLeaf: MenuNode = {
      label: 'Edit',
      command: 'config:edit',
      action: innerAction,
    };
    const branch: MenuNode = { label: 'Settings', children: [innerLeaf] };

    queuePicks(branch, innerLeaf);

    const result = await navigateMenu({
      menu: [branch],
      theme: baseTheme,
      interactive: 'one-shot',
    });

    expect(result).toEqual({ kind: 'completed', command: 'config:edit' });
    expect(innerAction).toHaveBeenCalledOnce();
  });

  it('Voltar from submenu returns to root and continues', async () => {
    const action = vi.fn();
    const leafA: MenuNode = { label: 'A', command: 'a', action };
    const leafB: MenuNode = { label: 'B', command: 'b', action: vi.fn() };
    const branch: MenuNode = { label: 'Group', children: [leafB] };

    let call = 0;
    mocks.runMenuSelect.mockImplementation(
      ({ options }: { options: { value: unknown }[] }) => {
        call++;
        switch (call) {
          case 1:
            return Promise.resolve(branch);
          case 2: {
            // submenu: pick "Voltar" (last option at depth > 0)
            return Promise.resolve(options[options.length - 1]?.value);
          }
          case 3:
            return Promise.resolve(leafA);
          default:
            throw new Error('unexpected call');
        }
      },
    );

    const result = await navigateMenu({
      menu: [branch, leafA],
      theme: baseTheme,
      interactive: 'one-shot',
    });
    expect(result).toEqual({ kind: 'completed', command: 'a' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('cancellation in submenu propagates as cancelled', async () => {
    const leafA: MenuNode = { label: 'A', command: 'a', action: vi.fn() };
    const branch: MenuNode = { label: 'Group', children: [leafA] };

    queuePicks(branch, cancelSym);
    const result = await navigateMenu({
      menu: [branch],
      theme: baseTheme,
      interactive: 'one-shot',
    });
    expect(result).toEqual({ kind: 'cancelled' });
  });
});

describe('navigateMenu — args collection (one-shot)', () => {
  it('collects boolean arg before running action', async () => {
    const action = vi.fn();
    const leaf: MenuNode = {
      label: 'Build',
      command: 'build',
      args: { watch: { type: 'boolean' } },
      action,
    };

    queuePicks(leaf);
    mocks.confirm.mockResolvedValueOnce(true);

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });

    expect(result.kind).toBe('completed');
    expect(action).toHaveBeenCalledOnce();
    const ctx = action.mock.calls[0]?.[0] as { args: Record<string, unknown> };
    expect(ctx.args).toEqual({ watch: true });
  });

  it('collects required string arg', async () => {
    const action = vi.fn();
    const leaf: MenuNode = {
      label: 'Convert',
      command: 'convert',
      args: { file: { type: 'string', required: true } },
      action,
    };

    queuePicks(leaf);
    mocks.text.mockResolvedValueOnce('data.json');

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });

    expect(result.kind).toBe('completed');
    const ctx = action.mock.calls[0]?.[0] as { args: Record<string, unknown> };
    expect(ctx.args).toEqual({ file: 'data.json' });
  });

  it('returns to menu (does not exit) when user aborts arg prompt', async () => {
    const action = vi.fn();
    const leaf: MenuNode = {
      label: 'X',
      command: 'x',
      args: { foo: { type: 'string' } },
      action,
    };

    // 1st pick: user selects the leaf. text returns cancel → arg collection aborts.
    // 2nd pick: default impl picks Sair to terminate.
    queuePicks(leaf);
    mocks.text.mockResolvedValueOnce(cancelSym);

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'loop', // loop mode: terminates only via Sair
    });

    expect(result).toEqual({ kind: 'exited' });
    expect(action).not.toHaveBeenCalled();
  });

  it('collects enum arg via select', async () => {
    const action = vi.fn();
    const leaf: MenuNode = {
      label: 'Deploy',
      command: 'deploy',
      args: { env: { type: 'enum', options: ['prod', 'staging'], required: true } },
      action,
    };

    queuePicks(leaf);
    mocks.select.mockResolvedValueOnce('prod');

    await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
    });

    const ctx = action.mock.calls[0]?.[0] as { args: Record<string, unknown> };
    expect(ctx.args).toEqual({ env: 'prod' });
  });

  it('treats empty required string as arg cancellation (loops back to menu)', async () => {
    const action = vi.fn();
    const leaf: MenuNode = {
      label: 'X',
      command: 'x',
      args: { file: { type: 'string', required: true } },
      action,
    };

    queuePicks(leaf);
    mocks.text.mockResolvedValueOnce('');

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'loop',
    });

    // Loop: after arg cancellation, default mock picks Sair → exited.
    expect(result).toEqual({ kind: 'exited' });
    expect(action).not.toHaveBeenCalled();
  });
});

describe('navigateMenu — loop mode (default)', () => {
  it('after a successful action, returns to the menu (does not exit)', async () => {
    const action = vi.fn();
    const leaf: MenuNode = { label: 'Build', command: 'build', action };

    // 1st pick: leaf (action runs)
    // 2nd pick: leaf again (action runs again)
    // 3rd pick: default (Sair)
    queuePicks(leaf, leaf);

    const result = await navigateMenu({ menu: [leaf], theme: baseTheme });

    expect(result).toEqual({ kind: 'exited' });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('action that throws does NOT exit the loop; onActionError fires', async () => {
    const onActionError = vi.fn();
    const leaf: MenuNode = {
      label: 'Boom',
      command: 'boom',
      action: () => {
        throw new Error('internal failure xyz');
      },
    };

    queuePicks(leaf, leaf); // pick boom twice, then Sair

    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      onActionError,
    });

    expect(result).toEqual({ kind: 'exited' });
    expect(onActionError).toHaveBeenCalledTimes(2);
    const firstCall = onActionError.mock.calls[0] as [unknown, { command: string; args: Record<string, unknown> }];
    expect(firstCall[0]).toBeInstanceOf(Error);
    expect(firstCall[1].command).toBe('boom');
  });

  it('a throwing onActionError handler does not crash the menu', async () => {
    const leaf: MenuNode = {
      label: 'Boom',
      command: 'boom',
      action: () => {
        throw new Error('first');
      },
    };
    const onActionError = vi.fn(() => {
      throw new Error('handler also crashed');
    });

    queuePicks(leaf);
    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      onActionError,
    });

    expect(result).toEqual({ kind: 'exited' });
    expect(onActionError).toHaveBeenCalled();
  });
});

describe('navigateMenu — one-shot mode with errors', () => {
  it('returns action-error when action throws in one-shot mode', async () => {
    const onActionError = vi.fn();
    const leaf: MenuNode = {
      label: 'Boom',
      command: 'boom',
      action: () => {
        throw new Error('kaboom');
      },
    };

    queuePicks(leaf);
    const result = await navigateMenu({
      menu: [leaf],
      theme: baseTheme,
      interactive: 'one-shot',
      onActionError,
    });

    expect(result.kind).toBe('action-error');
    if (result.kind === 'action-error') {
      expect(result.command).toBe('boom');
      expect(result.error).toBeInstanceOf(Error);
    }
    expect(onActionError).toHaveBeenCalledOnce();
  });
});
