import mri from 'mri';
import type { ArgsSchema, CLIConfig, MenuLeaf, MenuNode } from '../types.js';
import { coerceArgsAgainstSchema } from './coerce-args.js';

export type RouteResult =
  | {
      readonly kind: 'matched';
      readonly leaf: MenuLeaf<ArgsSchema>;
      readonly path: readonly string[];
      readonly command: string;
      readonly args: Readonly<Record<string, unknown>>;
      readonly positionals: readonly string[];
      readonly rest: Readonly<Record<string, unknown>>;
    }
  | { readonly kind: 'empty-argv' }
  | { readonly kind: 'unknown-command'; readonly command: string }
  | {
      readonly kind: 'arg-error';
      readonly command: string;
      readonly argName: string;
      readonly reason: string;
    };

/**
 * Parse `argv` against a CLI config, find the matching leaf, and coerce flags
 * against the leaf's declared args schema. Returns a discriminated result with
 * either the matched leaf+args (plus raw positionals and undeclared flags) or a
 * structured failure.
 *
 * Global flags (`--help`, `--version`) are intentionally not handled here —
 * the orchestrator inspects raw argv before delegating to this routine.
 */
export function routeArgs(config: CLIConfig, argv: readonly string[]): RouteResult {
  if (argv.length === 0) return { kind: 'empty-argv' };

  const probe = mri([...argv]);
  const command = probe._[0];
  if (typeof command !== 'string' || command.length === 0) {
    return { kind: 'empty-argv' };
  }

  const found = findLeaf(config.menu, command, []);
  if (!found) return { kind: 'unknown-command', command };

  const { leaf, path } = found;
  const schema: ArgsSchema = leaf.args ?? {};

  // Drop the command token from positionals so `ctx._` holds only real positionals.
  const coerced = coerceArgsAgainstSchema(schema, argv, {
    strict: config.strict ?? true,
    dropPositionals: 1,
  });

  if (coerced.kind === 'arg-error') {
    return { kind: 'arg-error', command, argName: coerced.argName, reason: coerced.reason };
  }

  return {
    kind: 'matched',
    leaf,
    path,
    command,
    args: coerced.args,
    positionals: coerced.positionals,
    rest: coerced.rest,
  };
}

function findLeaf(
  menu: readonly MenuNode[],
  command: string,
  parentPath: readonly string[],
): { leaf: MenuLeaf<ArgsSchema>; path: readonly string[] } | null {
  for (const node of menu) {
    if ('children' in node) {
      const inner = findLeaf(node.children, command, [...parentPath, node.label]);
      if (inner) return inner;
      continue;
    }
    if ('command' in node && node.command === command) {
      return { leaf: node, path: [...parentPath, node.label] };
    }
  }
  return null;
}
