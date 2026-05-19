import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCtx } from '../src/runtime/action-ctx.js';

const clackMocks = vi.hoisted(() => {
  const cancelSymbol = Symbol('clack.cancel');
  return {
    cancelSymbol,
    confirm: vi.fn(),
    isCancel: vi.fn((v: unknown) => v === cancelSymbol),
    spinner: vi.fn(),
  };
});

vi.mock('@clack/prompts', () => ({
  confirm: clackMocks.confirm,
  isCancel: clackMocks.isCancel,
  spinner: clackMocks.spinner,
}));

describe('createCtx — args and command passthrough', () => {
  it('exposes command and args as given', () => {
    const ctx = createCtx({
      command: 'build',
      args: { watch: true, target: 'esm' },
    });
    expect(ctx.command).toBe('build');
    expect(ctx.args).toEqual({ watch: true, target: 'esm' });
  });
});

describe('createCtx.confirm', () => {
  beforeEach(() => {
    clackMocks.confirm.mockReset();
    clackMocks.isCancel.mockClear();
  });

  it('returns the resolved value when user confirms', async () => {
    clackMocks.confirm.mockResolvedValueOnce(true);
    const ctx = createCtx({ command: 'x', args: {} });
    const result = await ctx.confirm({ message: 'Proceed?' });
    expect(result).toBe(true);
    expect(clackMocks.confirm).toHaveBeenCalledWith({
      message: 'Proceed?',
      initialValue: undefined,
    });
  });

  it('returns false when user cancels (isCancel)', async () => {
    clackMocks.confirm.mockResolvedValueOnce(clackMocks.cancelSymbol);
    const ctx = createCtx({ command: 'x', args: {} });
    const result = await ctx.confirm({ message: 'Proceed?' });
    expect(result).toBe(false);
  });

  it('forwards initialValue', async () => {
    clackMocks.confirm.mockResolvedValueOnce(false);
    const ctx = createCtx({ command: 'x', args: {} });
    await ctx.confirm({ message: 'Cancel?', initialValue: false });
    expect(clackMocks.confirm).toHaveBeenCalledWith({
      message: 'Cancel?',
      initialValue: false,
    });
  });
});

describe('createCtx.spinner', () => {
  const clackSpinnerApi = {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    error: vi.fn(),
    cancel: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  };

  beforeEach(() => {
    Object.values(clackSpinnerApi).forEach((v) => {
      if (typeof v === 'function' && 'mockReset' in v) v.mockReset();
    });
    clackMocks.spinner.mockReset();
    clackMocks.spinner.mockReturnValue(clackSpinnerApi);
  });

  it('starts with initial message when provided', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    ctx.spinner('Loading...');
    expect(clackSpinnerApi.start).toHaveBeenCalledWith('Loading...');
  });

  it('does not start when no initial message', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    ctx.spinner();
    expect(clackSpinnerApi.start).not.toHaveBeenCalled();
  });

  it('update calls clack message', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    const s = ctx.spinner('Initial');
    s.update('Step 2');
    expect(clackSpinnerApi.message).toHaveBeenCalledWith('Step 2');
  });

  it('success calls clack stop with message', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    const s = ctx.spinner('Initial');
    s.success('Done!');
    expect(clackSpinnerApi.stop).toHaveBeenCalledWith('Done!');
  });

  it('error calls clack error with message', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    const s = ctx.spinner('Initial');
    s.error('Failed!');
    expect(clackSpinnerApi.error).toHaveBeenCalledWith('Failed!');
  });

  it('stop calls clack stop with no args', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    const s = ctx.spinner('Initial');
    s.stop();
    expect(clackSpinnerApi.stop).toHaveBeenCalledTimes(1);
    expect(clackSpinnerApi.stop.mock.calls[0]).toEqual([]);
  });
});

describe('createCtx.log', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it('info writes to stdout', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    ctx.log.info('hello');
    expect(stdoutWrite).toHaveBeenCalled();
    const written = String(stdoutWrite.mock.calls[0]?.[0]);
    expect(written).toContain('hello');
  });

  it('warn writes to stdout', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    ctx.log.warn('be careful');
    expect(stdoutWrite).toHaveBeenCalled();
  });

  it('error writes to stderr', () => {
    const ctx = createCtx({ command: 'x', args: {} });
    ctx.log.error('boom');
    expect(stderrWrite).toHaveBeenCalled();
    const written = String(stderrWrite.mock.calls[0]?.[0]);
    expect(written).toContain('boom');
  });

  it('applies theme.colors.primary to info via custom Colorizer fn', () => {
    const ctx = createCtx({
      command: 'x',
      args: {},
      theme: { colors: { primary: (s) => `<<${s}>>` } },
    });
    ctx.log.info('hi');
    const written = String(stdoutWrite.mock.calls[0]?.[0]);
    expect(written).toContain('<<i>>');
  });

  it('applies theme.colors.error to error via named color', () => {
    const ctx = createCtx({
      command: 'x',
      args: {},
      theme: { colors: { error: 'magenta' } },
    });
    ctx.log.error('oops');
    expect(stderrWrite).toHaveBeenCalled();
  });
});
