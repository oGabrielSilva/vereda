import type { ThemeSymbols } from '../types.js';

export interface ResolvedSymbols {
  readonly active: string;
  readonly inactive: string;
  readonly bar: string;
  readonly barStart: string;
  readonly barEnd: string;
  readonly success: string;
  readonly error: string;
}

const UNICODE: ResolvedSymbols = {
  active: '●',
  inactive: '◯',
  bar: '│',
  barStart: '╭',
  barEnd: '╰',
  success: '✔',
  error: '✖',
};

const ASCII: ResolvedSymbols = {
  active: '>',
  inactive: ' ',
  bar: '|',
  barStart: '+',
  barEnd: '+',
  success: 'v',
  error: 'x',
};

export function detectUnicodeSupport(env: Readonly<NodeJS.ProcessEnv> = process.env): boolean {
  if (env.VEREDA_NO_UNICODE !== undefined && env.VEREDA_NO_UNICODE !== '') return false;
  const term = env.TERM;
  if (term === 'dumb' || term === 'linux' || term === 'vt100') return false;
  return true;
}

/**
 * Merge user-provided symbols with the default set (Unicode or ASCII based on env).
 *
 * Each undefined custom slot falls back to the resolved default.
 */
export function resolveSymbols(
  custom: ThemeSymbols | undefined,
  env: Readonly<NodeJS.ProcessEnv> = process.env,
): ResolvedSymbols {
  const base = detectUnicodeSupport(env) ? UNICODE : ASCII;
  if (custom === undefined) return base;
  return {
    active: custom.active ?? base.active,
    inactive: custom.inactive ?? base.inactive,
    bar: custom.bar ?? base.bar,
    barStart: custom.barStart ?? base.barStart,
    barEnd: custom.barEnd ?? base.barEnd,
    success: custom.success ?? base.success,
    error: custom.error ?? base.error,
  };
}
