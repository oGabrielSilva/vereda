import pc from 'picocolors';
import type { ColorName, Colorizer } from '../types.js';

const IDENTITY = (text: string): string => text;

const NAMED_COLORS: Readonly<Record<ColorName, (text: string) => string>> = {
  black: pc.black,
  red: pc.red,
  green: pc.green,
  yellow: pc.yellow,
  blue: pc.blue,
  magenta: pc.magenta,
  cyan: pc.cyan,
  white: pc.white,
  gray: pc.gray,
};

export function isColorDisabled(env: Readonly<NodeJS.ProcessEnv> = process.env): boolean {
  const noColor = env.NO_COLOR;
  return noColor !== undefined && noColor !== '';
}

/**
 * Turn a Colorizer (name or function) into a concrete `(text) => text` function.
 *
 * Respects `NO_COLOR`: when set, returns identity regardless of input.
 */
export function resolveColorizer(
  c: Colorizer | undefined,
  fallback: (text: string) => string = IDENTITY,
  env: Readonly<NodeJS.ProcessEnv> = process.env,
): (text: string) => string {
  if (isColorDisabled(env)) return IDENTITY;
  if (c === undefined) return fallback;
  if (typeof c === 'function') return c;
  return NAMED_COLORS[c];
}
