import type { CLIConfig, CliMode, MenuNode } from '../types.js';

export interface InteractiveEnv {
  readonly stdin?: { readonly isTTY?: boolean };
  readonly stdout?: { readonly isTTY?: boolean };
  readonly env: Readonly<NodeJS.ProcessEnv>;
}

export type ModeDecision =
  | { readonly kind: 'render-menu' }
  | { readonly kind: 'route-argv' }
  | { readonly kind: 'print-help' }
  | { readonly kind: 'tty-required-error' };

export interface TtyContext {
  readonly interactive: boolean;
  readonly hasArgv: boolean;
}

const TRUTHY = new Set(['1', 'true', 'TRUE', 'yes']);

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.has(value);
}

export function isInteractive(env: InteractiveEnv = process): boolean {
  const stdinTty = env.stdin?.isTTY === true;
  const stdoutTty = env.stdout?.isTTY === true;
  const ciFlag = isTruthy(env.env.CI);
  const forceNoTty = isTruthy(env.env.FORCE_NO_TTY);
  return stdinTty && stdoutTty && !ciFlag && !forceNoTty;
}

export function detectMode(
  config: CLIConfig,
  argv: readonly string[],
  ttyCtx?: TtyContext,
): ModeDecision {
  const ctx: TtyContext = ttyCtx ?? {
    interactive: isInteractive(),
    hasArgv: argv.length > 0,
  };
  const mode: CliMode = config.mode ?? 'auto';

  switch (mode) {
    case 'auto':
      if (ctx.interactive) return { kind: 'render-menu' };
      if (ctx.hasArgv) return { kind: 'route-argv' };
      return { kind: 'print-help' };
    case 'interactive-only':
      if (ctx.interactive) return { kind: 'render-menu' };
      return { kind: 'tty-required-error' };
    case 'argv-only':
      if (ctx.hasArgv) return { kind: 'route-argv' };
      return { kind: 'print-help' };
  }
}

interface CommandEntry {
  command: string;
  label: string;
  hint?: string;
}

export function printPlainHelp(
  name: string,
  menu: readonly MenuNode[],
  out: { write(chunk: string): void } = process.stdout,
): void {
  out.write(`Uso: ${name} <comando> [opções]\n\n`);
  out.write('Comandos:\n');

  const commands: CommandEntry[] = [];
  collectCommands(menu, commands);

  if (commands.length === 0) {
    out.write('  (nenhum comando registrado)\n\n');
    return;
  }

  const maxLen = Math.max(...commands.map((c) => c.command.length));
  for (const c of commands) {
    const cmd = c.command.padEnd(maxLen + 2);
    const hint = c.hint !== undefined ? `  (${c.hint})` : '';
    out.write(`  ${cmd}${c.label}${hint}\n`);
  }
  out.write('\n');
}

function collectCommands(menu: readonly MenuNode[], out: CommandEntry[]): void {
  for (const node of menu) {
    if ('children' in node) {
      collectCommands(node.children, out);
      continue;
    }
    if ('command' in node) {
      const entry: CommandEntry = { command: node.command, label: node.label };
      if (node.hint !== undefined) entry.hint = node.hint;
      out.push(entry);
    }
  }
}
