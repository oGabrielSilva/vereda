import type { ArgsSchema, CLIConfig, MenuLeaf } from './types.js';

/**
 * Identity helper that captures a CLI config with full literal inference.
 *
 * The `const` type parameter preserves literal types of strings and unions in the config,
 * so consumers don't need `as const` at the call site.
 *
 * Per-leaf inference of `ctx.args` requires wrapping each leaf in {@link defineMenuItem}.
 * Without that wrapper, `MenuNode` collapses to the broad `MenuLeaf<ArgsSchema>` and
 * `ctx.args` is typed against the union of all possible arg types.
 *
 * @example
 * ```ts
 * import { defineCLI, defineMenuItem } from 'vereda-cli';
 *
 * export default defineCLI({
 *   name: 'mycli',
 *   menu: [
 *     defineMenuItem({
 *       label: 'Build',
 *       command: 'build',
 *       args: { watch: { type: 'boolean' } },
 *       action: async (ctx) => {
 *         //   ^? ctx.args.watch: boolean | undefined
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function defineCLI<const T extends CLIConfig>(config: T): T {
  return config;
}

/**
 * Wrap a leaf to opt into per-leaf inference of `ctx.args`.
 *
 * The `const A` type parameter narrows `args` to its literal shape, so the
 * `action` callback's `ctx.args` reflects the exact arg types declared at the leaf.
 *
 * The return type widens back to `MenuLeaf<ArgsSchema>` so the wrapped leaf
 * fits inside `MenuNode` arrays (the variance with action's `ctx` parameter
 * otherwise blocks narrow-to-wide assignment).
 */
export function defineMenuItem<const A extends ArgsSchema>(item: MenuLeaf<A>): MenuLeaf<ArgsSchema> {
  return item;
}

export { run } from './runtime/run.js';

export type {
  ActionContext,
  ActionErrorContext,
  ActionErrorHandler,
  ActionLog,
  ActionSpinner,
  ArgDef,
  ArgsSchema,
  CLIConfig,
  CliMode,
  ColorName,
  Colorizer,
  InferArgs,
  InteractiveBehavior,
  KeyAction,
  MenuBranch,
  MenuLeaf,
  MenuNode,
  ThemeColors,
  ThemeConfig,
  ThemeSymbols,
} from './types.js';
