import { SelectPrompt, isCancel } from '@clack/core';
import type { ResolvedTheme } from '../theme/apply.js';

export type SelectState = 'initial' | 'active' | 'submit' | 'cancel';

export interface MenuOption<T> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface RenderFrameInput<T> {
  readonly state: SelectState;
  readonly cursor: number;
  readonly options: readonly MenuOption<T>[];
  readonly theme: ResolvedTheme;
  readonly message: string;
  readonly maxItems?: number;
}

/**
 * Pure render: turn a (state, cursor, options, theme) snapshot into a frame string.
 *
 * Exported standalone so snapshot tests can pin output without spinning up
 * a real terminal.
 */
export function renderMenuFrame<T>(input: RenderFrameInput<T>): string {
  const { state, cursor, options, theme, message, maxItems } = input;
  const { colors, symbols } = theme;
  const lines: string[] = [];
  const total = options.length;

  if (state === 'submit') {
    const selected = options[cursor];
    const tail = selected ? ` ${colors.dimmed('·')} ${selected.label}` : '';
    lines.push(`${colors.success(symbols.success)} ${message}${tail}`);
    return lines.join('\n');
  }

  if (state === 'cancel') {
    lines.push(`${colors.error(symbols.error)} ${message} ${colors.dimmed('(cancelado)')}`);
    return lines.join('\n');
  }

  lines.push(`${colors.primary(symbols.barStart)} ${message}`);

  if (total === 0) {
    lines.push(`${colors.dimmed(symbols.bar)} ${colors.dimmed('(sem opções)')}`);
    lines.push(`${colors.primary(symbols.barEnd)}`);
    return lines.join('\n');
  }

  const requestedWindow = maxItems !== undefined && maxItems > 0 ? maxItems : total;
  const windowSize = Math.min(requestedWindow, total);

  let start = 0;
  if (total > windowSize) {
    const half = Math.floor(windowSize / 2);
    start = Math.max(0, Math.min(cursor - half, total - windowSize));
  }
  const end = start + windowSize;

  if (start > 0) {
    lines.push(`${colors.dimmed(symbols.bar)} ${colors.dimmed(`(${start} acima)`)}`);
  }

  for (let i = start; i < end; i++) {
    const opt = options[i];
    if (opt === undefined) continue;
    const isCursor = i === cursor;
    const symbol = isCursor ? colors.primary(symbols.active) : colors.dimmed(symbols.inactive);
    const label = isCursor ? colors.primary(opt.label) : colors.dimmed(opt.label);
    const hintTail = opt.hint !== undefined ? `  ${colors.dimmed(`(${opt.hint})`)}` : '';
    lines.push(`${colors.primary(symbols.bar)} ${symbol}  ${label}${hintTail}`);
  }

  const remaining = total - end;
  if (remaining > 0) {
    lines.push(`${colors.dimmed(symbols.bar)} ${colors.dimmed(`(${remaining} abaixo)`)}`);
  }

  lines.push(`${colors.primary(symbols.barEnd)}`);
  return lines.join('\n');
}

export interface RunMenuSelectOptions<T> {
  readonly options: readonly MenuOption<T>[];
  readonly message: string;
  readonly theme: ResolvedTheme;
  readonly initialValue?: T;
  readonly maxItems?: number;
}

const CANCEL_SYMBOL = Symbol.for('vereda.cancel');
export type CancelSentinel = typeof CANCEL_SYMBOL;

export function isMenuCancel(value: unknown): value is CancelSentinel {
  return value === CANCEL_SYMBOL;
}

/**
 * Open a navigable Select prompt wired to the custom renderer.
 * Resolves with the picked value or a stable cancel sentinel.
 */
export async function runMenuSelect<T>(opts: RunMenuSelectOptions<T>): Promise<T | CancelSentinel> {
  type Opt = MenuOption<T> & { disabled?: boolean };
  const promptOptions: Opt[] = [...opts.options];

  const prompt = new SelectPrompt<Opt>({
    options: promptOptions,
    ...(opts.initialValue !== undefined ? { initialValue: opts.initialValue } : {}),
    render() {
      const state = this.state as SelectState;
      const cursor = this.cursor;
      const frame: RenderFrameInput<T> = {
        state,
        cursor,
        options: opts.options,
        theme: opts.theme,
        message: opts.message,
        ...(opts.maxItems !== undefined ? { maxItems: opts.maxItems } : {}),
      };
      return renderMenuFrame(frame);
    },
  });

  const result = await prompt.prompt();
  if (isCancel(result)) return CANCEL_SYMBOL;
  return result as T;
}
