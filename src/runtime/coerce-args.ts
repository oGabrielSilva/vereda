import mri from 'mri';
import type { ArgDef, ArgsSchema } from '../types.js';

/**
 * Result of coercing argv against an args schema.
 *
 * `args` holds the declared, coerced values (undefined entries omitted).
 * `_` holds the raw positionals after the command token.
 * `rest` holds flags present in argv but not declared in the schema — always
 * empty when `strict` is true (an undeclared flag is an error there instead).
 */
export type CoerceResult =
  | {
      readonly kind: 'ok';
      readonly args: Record<string, unknown>;
      readonly positionals: string[];
      readonly rest: Record<string, unknown>;
    }
  | { readonly kind: 'arg-error'; readonly argName: string; readonly reason: string };

export interface CoerceOptions {
  /**
   * When true (default), a flag not declared in the schema is an `arg-error`.
   * When false, undeclared flags are collected into `rest`.
   */
  readonly strict?: boolean;
  /**
   * How many leading positionals to drop from `_` before exposing it. Used to
   * strip the command token(s) that `route-args` already consumed. Defaults to 0.
   */
  readonly dropPositionals?: number;
}

/**
 * Parse `argv` with `mri` against a declared args `schema`, coerce each declared
 * value, and split out positionals (`_`) and undeclared flags (`rest`).
 *
 * Shared by `route-args` (command routing) and the interactive menu (pre-filling
 * args already supplied on the command line) so both honor the same rules.
 */
export function coerceArgsAgainstSchema(
  schema: ArgsSchema,
  argv: readonly string[],
  options: CoerceOptions = {},
): CoerceResult {
  const strict = options.strict ?? true;
  const dropPositionals = options.dropPositionals ?? 0;
  const entries = Object.entries(schema);

  const booleanKeys: string[] = [];
  const stringKeys: string[] = [];
  const defaults: Record<string, unknown> = {};

  for (const [name, def] of entries) {
    if (def.type === 'boolean') booleanKeys.push(name);
    else stringKeys.push(name);
    if (def.type === 'string' && def.default !== undefined) {
      defaults[name] = def.default;
    }
  }

  const parsed = mri<Record<string, unknown>>([...argv], {
    boolean: booleanKeys,
    string: stringKeys,
    default: defaults,
  });

  const args: Record<string, unknown> = {};
  for (const [name, def] of entries) {
    const value = coerceOne(name, def, parsed[name]);
    if ('error' in value) {
      return { kind: 'arg-error', argName: name, reason: value.error };
    }
    if (value.value !== undefined) {
      args[name] = value.value;
    }
  }

  const declared = new Set(entries.map(([name]) => name));
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(parsed)) {
    if (key === '_' || declared.has(key)) continue;
    if (strict) {
      return { kind: 'arg-error', argName: key, reason: `Flag desconhecida: --${key}` };
    }
    rest[key] = parsed[key];
  }

  const rawPositionals = Array.isArray(parsed._) ? parsed._.map(String) : [];
  const positionals = rawPositionals.slice(dropPositionals);

  return { kind: 'ok', args, positionals, rest };
}

type CoerceOne = { value: unknown } | { error: string };

function coerceOne(name: string, def: ArgDef, raw: unknown): CoerceOne {
  const isRequired = 'required' in def && def.required === true;
  const isMissing = raw === undefined || raw === null || raw === '';

  if (isMissing) {
    if (isRequired) {
      return { error: `Argumento obrigatório ausente: --${name}.` };
    }
    if (def.type === 'string' && def.default !== undefined) {
      return { value: def.default };
    }
    return { value: undefined };
  }

  switch (def.type) {
    case 'boolean':
      return { value: Boolean(raw) };
    case 'string': {
      if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
        return { error: `Valor inválido para --${name}.` };
      }
      return { value: typeof raw === 'string' ? raw : String(raw) };
    }
    case 'enum': {
      if (typeof raw !== 'string') {
        return { error: `Valor inválido para --${name} (esperado string).` };
      }
      if (!def.options.includes(raw)) {
        return {
          error: `Valor "${raw}" não é permitido em --${name}. Use: ${def.options.join(', ')}.`,
        };
      }
      return { value: raw };
    }
  }
}
