import mri from 'mri';
import { confirm, isCancel, select, text } from '@clack/prompts';
import { isMenuCancel, runMenuSelect, type MenuOption } from '../renderer/menu-select.js';
import type { ResolvedTheme } from '../theme/apply.js';
import type {
  ActionErrorHandler,
  ArgDef,
  ArgsSchema,
  InteractiveBehavior,
  MenuLeaf,
  MenuNode,
  ThemeConfig,
} from '../types.js';
import { createCtx } from './action-ctx.js';
import { coerceArgsAgainstSchema } from './coerce-args.js';
import { restoreTerminal } from './terminal.js';

export type NavigationResult =
  | { readonly kind: 'completed'; readonly command: string }
  | { readonly kind: 'action-error'; readonly command: string; readonly error: unknown }
  | { readonly kind: 'exited' }
  | { readonly kind: 'cancelled' };

type LevelResult = NavigationResult | { readonly kind: 'back' };

const BACK = Symbol('vereda.back');
const EXIT = Symbol('vereda.exit');

type PickValue = MenuNode | typeof BACK | typeof EXIT;

export interface NavigateMenuOptions {
  readonly menu: readonly MenuNode[];
  readonly theme: ResolvedTheme;
  readonly themeConfig?: ThemeConfig;
  readonly rootMessage?: string;
  readonly interactive?: InteractiveBehavior;
  readonly onActionError?: ActionErrorHandler;
  /**
   * Raw argv passed through from `run`. When a chosen leaf's command matches the
   * argv command, args already supplied there pre-fill the leaf and are not
   * prompted. Positionals/undeclared flags surface as `ctx._` / `ctx.rest`.
   */
  readonly argv?: readonly string[];
  readonly strict?: boolean;
}

interface ProvidedArgs {
  readonly command: string | undefined;
  readonly args: Record<string, unknown>;
  readonly positionals: readonly string[];
  readonly rest: Record<string, unknown>;
}

export async function navigateMenu(opts: NavigateMenuOptions): Promise<NavigationResult> {
  const result = await navigateLevel(opts.menu, opts, 0);
  if (result.kind === 'back') return { kind: 'exited' };
  return result;
}

async function navigateLevel(
  level: readonly MenuNode[],
  opts: NavigateMenuOptions,
  depth: number,
): Promise<LevelResult> {
  while (true) {
    const options = buildOptions(level, depth);
    const picked = await runMenuSelect<PickValue>({
      options,
      message: depth === 0 ? opts.rootMessage ?? 'Menu principal' : 'Submenu',
      theme: opts.theme,
    });

    if (isMenuCancel(picked)) return { kind: 'cancelled' };
    if (picked === BACK) return { kind: 'back' };
    if (picked === EXIT) return { kind: 'exited' };

    const node = picked;
    if ('children' in node) {
      const inner = await navigateLevel(node.children, opts, depth + 1);
      if (inner.kind === 'back') continue;
      return inner;
    }

    const provided = resolveProvided(node, opts);
    const collected = await collectArgs(node, provided.args);
    if (collected === 'cancelled') {
      // User backed out of arg collection — return to this menu, do not exit.
      continue;
    }

    const cliCtx = createCtx({
      command: node.command,
      args: collected,
      positionals: provided.positionals,
      rest: provided.rest,
      ...(opts.themeConfig !== undefined ? { theme: opts.themeConfig } : {}),
    });

    const mode: InteractiveBehavior = opts.interactive ?? 'loop';

    try {
      await node.action(cliCtx);
    } catch (err) {
      if (opts.onActionError !== undefined) {
        try {
          await opts.onActionError(err, { command: node.command, args: collected });
        } catch {
          // A throwing error handler should never crash the menu.
        }
      } else {
        process.stderr.write(`${opts.theme.messages.error}\n`);
      }
      if (mode === 'one-shot') {
        return { kind: 'action-error', command: node.command, error: err };
      }
      continue;
    } finally {
      // An action may have opened its own prompts; restore the terminal so the
      // next menu render starts from a clean stdin/cursor state.
      restoreTerminal();
    }

    if (mode === 'one-shot') {
      return { kind: 'completed', command: node.command };
    }
    continue;
  }
}

/**
 * If argv targeted this exact leaf, pre-fill its declared args (and surface raw
 * positionals/undeclared flags). Otherwise return empties — argv for one command
 * must not bleed into a different leaf the user navigated to.
 */
function resolveProvided(leaf: MenuLeaf<ArgsSchema>, opts: NavigateMenuOptions): ProvidedArgs {
  const empty: ProvidedArgs = { command: undefined, args: {}, positionals: [], rest: {} };
  if (opts.argv === undefined || opts.argv.length === 0) return empty;

  const probe = mri([...opts.argv]);
  const command = probe._[0];
  if (typeof command !== 'string' || command !== leaf.command) return empty;

  const schema: ArgsSchema = leaf.args ?? {};
  const coerced = coerceArgsAgainstSchema(schema, opts.argv, {
    strict: opts.strict ?? true,
    dropPositionals: 1,
  });
  if (coerced.kind === 'arg-error') return empty;

  return {
    command,
    args: coerced.args,
    positionals: coerced.positionals,
    rest: coerced.rest,
  };
}

function buildOptions(level: readonly MenuNode[], depth: number): MenuOption<PickValue>[] {
  const opts: MenuOption<PickValue>[] = level.map((n) => {
    const opt: MenuOption<PickValue> = { value: n, label: n.label };
    if (n.hint !== undefined) {
      return { ...opt, hint: n.hint };
    }
    return opt;
  });

  if (depth > 0) {
    opts.push({ value: BACK, label: '↩ Voltar' });
  } else {
    opts.push({ value: EXIT, label: '✖ Sair' });
  }
  return opts;
}

type ArgPromptResult =
  | { readonly kind: 'ok'; readonly value: unknown }
  | { readonly kind: 'cancelled' };

/**
 * Decide whether the interactive menu should prompt for an arg.
 * - Already provided via argv → never prompt (use the provided value).
 * - `prompt: true` → always prompt.
 * - `prompt: false` → never prompt (fall back to default / undefined).
 * - otherwise → prompt only when required. Booleans never prompt by default.
 */
function shouldPrompt(def: ArgDef, alreadyProvided: boolean): boolean {
  if (alreadyProvided) return false;
  if (def.prompt === true) return true;
  if (def.prompt === false) return false;
  if (def.type === 'boolean') return false;
  return def.required === true;
}

async function collectArgs(
  leaf: MenuLeaf<ArgsSchema>,
  provided: Record<string, unknown>,
): Promise<Record<string, unknown> | 'cancelled'> {
  if (leaf.args === undefined) return { ...provided };
  const collected: Record<string, unknown> = { ...provided };

  for (const [name, def] of Object.entries(leaf.args)) {
    const alreadyProvided = provided[name] !== undefined;
    if (alreadyProvided) continue;

    if (!shouldPrompt(def, alreadyProvided)) {
      // Not prompting: fall back to a string default when present.
      if (def.type === 'string' && def.default !== undefined) {
        collected[name] = def.default;
      }
      continue;
    }

    const result = await promptForArg(name, def);
    if (result.kind === 'cancelled') return 'cancelled';
    if (result.value !== undefined) collected[name] = result.value;
  }
  return collected;
}

async function promptForArg(name: string, def: ArgDef): Promise<ArgPromptResult> {
  switch (def.type) {
    case 'boolean': {
      const r = await confirm({ message: name });
      if (isCancel(r)) return { kind: 'cancelled' };
      return { kind: 'ok', value: r };
    }
    case 'string': {
      const isRequired = def.required === true;
      const baseOpts: Parameters<typeof text>[0] = { message: name };
      if (def.default !== undefined) baseOpts.initialValue = def.default;
      const r = await text(baseOpts);
      if (isCancel(r)) return { kind: 'cancelled' };
      if (typeof r === 'string' && r.length === 0 && isRequired) return { kind: 'cancelled' };
      return { kind: 'ok', value: r };
    }
    case 'enum': {
      const r = await select({
        message: name,
        options: def.options.map((o) => ({ value: o, label: o })),
      });
      if (isCancel(r)) return { kind: 'cancelled' };
      return { kind: 'ok', value: r };
    }
  }
}
