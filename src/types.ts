/**
 * Declarative argument definition for a menu leaf.
 *
 * Boolean args are always optional (`required?: false`); presence in argv toggles them on.
 * String and enum args may be marked `required: true`.
 */
export type ArgDef =
  | { readonly type: 'boolean'; readonly required?: false }
  | { readonly type: 'string'; readonly required?: boolean; readonly default?: string }
  | { readonly type: 'enum'; readonly options: readonly string[]; readonly required?: boolean };

export type ArgsSchema = Readonly<Record<string, ArgDef>>;

type InferArg<A extends ArgDef> =
  [A] extends [{ type: 'boolean' }] ? boolean :
  [A] extends [{ type: 'enum'; options: readonly (infer O)[] }] ? O :
  [A] extends [{ type: 'string' }] ? string :
  never;

type RequiredKeys<T extends ArgsSchema> = {
  [K in keyof T]: T[K] extends { required: true } ? K : never;
}[keyof T];

type OptionalKeys<T extends ArgsSchema> = Exclude<keyof T, RequiredKeys<T>>;

export type InferArgs<T extends ArgsSchema> =
  & { readonly [K in RequiredKeys<T>]: InferArg<T[K]> }
  & { readonly [K in OptionalKeys<T>]?: InferArg<T[K]> };

export interface ActionSpinner {
  update(message: string): void;
  success(message?: string): void;
  error(message?: string): void;
  stop(): void;
}

export interface ActionLog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ActionContext<TArgs extends ArgsSchema = Record<string, never>> {
  readonly args: InferArgs<TArgs>;
  readonly command: string;
  confirm(opts: { message: string; initialValue?: boolean }): Promise<boolean>;
  spinner(message?: string): ActionSpinner;
  readonly log: ActionLog;
}

export type ColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray';

export type Colorizer = ColorName | ((text: string) => string);

export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'space' | 'enter' | 'cancel';

export interface ThemeColors {
  primary?: Colorizer;
  success?: Colorizer;
  error?: Colorizer;
  warning?: Colorizer;
  dimmed?: Colorizer;
}

export interface ThemeSymbols {
  active?: string;
  inactive?: string;
  bar?: string;
  barStart?: string;
  barEnd?: string;
  success?: string;
  error?: string;
}

export interface ThemeConfig {
  messages?: { cancel?: string; error?: string };
  keyAliases?: Readonly<Record<string, KeyAction>>;
  colors?: ThemeColors;
  symbols?: ThemeSymbols;
}

export type CliMode = 'auto' | 'interactive-only' | 'argv-only';

/**
 * Leaf node: terminates with an action callback.
 * `args` and `action` types co-vary so `ctx.args` is inferred per-leaf.
 */
export interface MenuLeaf<A extends ArgsSchema = ArgsSchema> {
  readonly label: string;
  readonly hint?: string;
  readonly command: string;
  readonly args?: A;
  readonly action: (ctx: ActionContext<A>) => Promise<void> | void;
}

/**
 * Branch node: groups other nodes. No action, no command, no args.
 */
export interface MenuBranch {
  readonly label: string;
  readonly hint?: string;
  readonly children: readonly MenuNode[];
}

export type MenuNode = MenuLeaf<ArgsSchema> | MenuBranch;

export interface CLIConfig {
  readonly name: string;
  readonly menu: readonly MenuNode[];
  readonly mode?: CliMode;
  readonly theme?: ThemeConfig;
}
