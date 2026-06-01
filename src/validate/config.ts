import type { CLIConfig, ColorName, MenuNode, ThemeConfig } from '../types.js';
import { ConfigError } from './errors.js';

export interface ValidationReport {
  readonly errors: readonly ConfigError[];
  readonly warnings: readonly ConfigError[];
}

const RESERVED_COMMANDS: readonly string[] = ['-h', '--help', '--version', '-v'];
const MAX_DEPTH = 8;
const VALID_COLORS: ReadonlySet<string> = new Set<ColorName>([
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
]);

export function validateConfig(config: CLIConfig): ValidationReport {
  const errors: ConfigError[] = [];
  const warnings: ConfigError[] = [];

  walkMenu(config.menu, [], 0, errors, warnings);

  if (config.theme) {
    validateTheme(config.theme, errors);
  }

  return { errors, warnings };
}

function walkMenu(
  menu: readonly MenuNode[],
  parentPath: readonly string[],
  depth: number,
  errors: ConfigError[],
  warnings: ConfigError[],
): void {
  if (depth > MAX_DEPTH) {
    warnings.push(
      new ConfigError(
        'deep_nesting',
        parentPath,
        `Profundidade ${depth} excede o limite recomendado (${MAX_DEPTH}).`,
      ),
    );
  }

  const seenCommands = new Set<string>();

  for (let index = 0; index < menu.length; index++) {
    const node = menu[index];
    if (!node) continue;

    const nodePath = [...parentPath, node.label || `[${index}]`];

    const isObject = typeof node === 'object' && node !== null;
    const hasChildren = isObject && 'children' in node && Array.isArray((node as { children: unknown }).children);
    const hasCommand = isObject && 'command' in node && typeof (node as { command: unknown }).command === 'string';
    const hasAction = isObject && 'action' in node && typeof (node as { action: unknown }).action === 'function';
    const hasArgs = isObject && 'args' in node && (node as { args: unknown }).args != null;

    if (hasChildren) {
      const branch = node as { children: readonly MenuNode[] };
      if (branch.children.length === 0) {
        errors.push(
          new ConfigError('empty_children', nodePath, 'Submenu vazio (children: []) não é permitido.'),
        );
      } else {
        walkMenu(branch.children, nodePath, depth + 1, errors, warnings);
      }
      continue;
    }

    if (hasCommand && hasAction) {
      const leaf = node as { command: string };
      if (RESERVED_COMMANDS.includes(leaf.command)) {
        errors.push(
          new ConfigError(
            'reserved_command',
            nodePath,
            `Comando "${leaf.command}" é reservado (${RESERVED_COMMANDS.join(', ')}).`,
          ),
        );
      }
      if (seenCommands.has(leaf.command)) {
        errors.push(
          new ConfigError(
            'duplicate_command',
            nodePath,
            `Comando "${leaf.command}" duplicado entre siblings.`,
          ),
        );
      }
      seenCommands.add(leaf.command);
      if (hasArgs) {
        validateLeafArgs((node as { args: unknown }).args, nodePath, warnings);
      }
      continue;
    }

    if (hasArgs && !hasAction) {
      errors.push(
        new ConfigError(
          'args_without_action',
          nodePath,
          'Nó com "args" precisa de "action" para consumir os argumentos.',
        ),
      );
      continue;
    }

    errors.push(
      new ConfigError(
        'invalid_leaf',
        nodePath,
        'Nó precisa ter ("command" + "action") ou "children" com pelo menos um item.',
      ),
    );
  }
}

function validateLeafArgs(
  args: unknown,
  nodePath: readonly string[],
  warnings: ConfigError[],
): void {
  if (typeof args !== 'object' || args === null) return;
  for (const [name, raw] of Object.entries(args as Record<string, unknown>)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const def = raw as { required?: unknown; prompt?: unknown; default?: unknown };
    // A required arg that never prompts and has no default can never be filled
    // through the interactive menu — warn so it isn't a silent undefined.
    if (def.required === true && def.prompt === false && def.default === undefined) {
      warnings.push(
        new ConfigError(
          'required_never_prompted',
          [...nodePath, name],
          `Argumento "${name}" é required com prompt:false e sem default — nunca será preenchido no menu interativo.`,
        ),
      );
    }
  }
}

function validateTheme(theme: ThemeConfig, errors: ConfigError[]): void {
  if (theme.colors) {
    for (const [key, value] of Object.entries(theme.colors)) {
      if (typeof value === 'string' && !VALID_COLORS.has(value)) {
        errors.push(
          new ConfigError(
            'invalid_color',
            ['theme', 'colors', key],
            `Cor "${value}" não é nome reconhecido. Use uma de: ${[...VALID_COLORS].join(', ')}.`,
          ),
        );
      }
    }
  }

  if (theme.symbols) {
    for (const [key, value] of Object.entries(theme.symbols)) {
      if (typeof value === 'string' && [...value].length > 2) {
        errors.push(
          new ConfigError(
            'invalid_symbol',
            ['theme', 'symbols', key],
            `Símbolo "${value}" deve ter no máximo 2 caracteres.`,
          ),
        );
      }
    }
  }
}
