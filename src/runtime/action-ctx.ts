import { confirm, isCancel, spinner as clackSpinner } from '@clack/prompts';
import pc from 'picocolors';
import type {
  ActionContext,
  ActionLog,
  ActionSpinner,
  ArgsSchema,
  Colorizer,
  InferArgs,
  ThemeConfig,
} from '../types.js';

export interface CreateCtxOpts {
  readonly command: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly positionals?: readonly string[];
  readonly rest?: Readonly<Record<string, unknown>>;
  readonly theme?: ThemeConfig;
}

/**
 * Build the `ctx` object passed to an action callback.
 *
 * `args` is trusted to have been coerced by `route-args` against the leaf's schema —
 * the type assertion to `InferArgs<TArgs>` reflects that contract.
 */
export function createCtx<TArgs extends ArgsSchema>(opts: CreateCtxOpts): ActionContext<TArgs> {
  const colors = resolveLogColors(opts.theme);

  return {
    args: opts.args as InferArgs<TArgs>,
    command: opts.command,
    _: opts.positionals ?? [],
    rest: opts.rest ?? {},

    confirm: async ({ message, initialValue }) => {
      const result = await confirm(
        initialValue === undefined ? { message } : { message, initialValue },
      );
      if (isCancel(result)) return false;
      return result;
    },

    spinner: (initialMessage) => buildSpinner(initialMessage),

    log: buildLog(colors),
  };
}

function buildSpinner(initialMessage?: string): ActionSpinner {
  const s = clackSpinner();
  if (initialMessage !== undefined) s.start(initialMessage);
  return {
    update: (msg) => s.message(msg),
    success: (msg) => s.stop(msg),
    error: (msg) => s.error(msg),
    stop: () => s.stop(),
  };
}

interface LogColors {
  info: (text: string) => string;
  warn: (text: string) => string;
  error: (text: string) => string;
}

function buildLog(colors: LogColors): ActionLog {
  return {
    info: (msg) => {
      process.stdout.write(`${colors.info('i')} ${msg}\n`);
    },
    warn: (msg) => {
      process.stdout.write(`${colors.warn('!')} ${msg}\n`);
    },
    error: (msg) => {
      process.stderr.write(`${colors.error('x')} ${msg}\n`);
    },
  };
}

function resolveLogColors(theme?: ThemeConfig): LogColors {
  const c = theme?.colors;
  return {
    info: resolveColorizer(c?.primary, pc.cyan),
    warn: resolveColorizer(c?.warning, pc.yellow),
    error: resolveColorizer(c?.error, pc.red),
  };
}

function resolveColorizer(
  c: Colorizer | undefined,
  fallback: (text: string) => string,
): (text: string) => string {
  if (c === undefined) return fallback;
  if (typeof c === 'function') return c;
  switch (c) {
    case 'black':
      return pc.black;
    case 'red':
      return pc.red;
    case 'green':
      return pc.green;
    case 'yellow':
      return pc.yellow;
    case 'blue':
      return pc.blue;
    case 'magenta':
      return pc.magenta;
    case 'cyan':
      return pc.cyan;
    case 'white':
      return pc.white;
    case 'gray':
      return pc.gray;
  }
}
