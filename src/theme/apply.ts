import { updateSettings } from '@clack/prompts';
import pc from 'picocolors';
import { resolveColorizer } from '../renderer/ansi.js';
import { resolveSymbols, type ResolvedSymbols } from '../renderer/symbols.js';
import type { KeyAction, ThemeConfig } from '../types.js';

export interface ResolvedColors {
  readonly primary: (text: string) => string;
  readonly success: (text: string) => string;
  readonly error: (text: string) => string;
  readonly warning: (text: string) => string;
  readonly dimmed: (text: string) => string;
}

export interface ResolvedMessages {
  readonly cancel: string;
  readonly error: string;
}

export interface ResolvedTheme {
  readonly colors: ResolvedColors;
  readonly symbols: ResolvedSymbols;
  readonly messages: ResolvedMessages;
}

const DEFAULT_CANCEL = 'Operação cancelada.';
const DEFAULT_ERROR = 'Algo deu errado.';

/**
 * Translate the user-facing `ThemeConfig` into runtime helpers.
 *
 * Side-effect: forwards `messages` and `keyAliases` to `@clack/prompts.updateSettings`
 * so secondary prompts (text/confirm/select-enum used for args collection)
 * pick up the same cancel/error text and key bindings.
 */
export function applyTheme(theme: ThemeConfig | undefined): ResolvedTheme {
  if (theme?.messages !== undefined || theme?.keyAliases !== undefined) {
    const settings: { messages?: { cancel?: string; error?: string }; aliases?: Record<string, KeyAction> } = {};
    if (theme.messages !== undefined) settings.messages = theme.messages;
    if (theme.keyAliases !== undefined) settings.aliases = { ...theme.keyAliases };
    updateSettings(settings);
  }

  const colors: ResolvedColors = {
    primary: resolveColorizer(theme?.colors?.primary, pc.cyan),
    success: resolveColorizer(theme?.colors?.success, pc.green),
    error: resolveColorizer(theme?.colors?.error, pc.red),
    warning: resolveColorizer(theme?.colors?.warning, pc.yellow),
    dimmed: resolveColorizer(theme?.colors?.dimmed, pc.gray),
  };

  const symbols = resolveSymbols(theme?.symbols);

  const messages: ResolvedMessages = {
    cancel: theme?.messages?.cancel ?? DEFAULT_CANCEL,
    error: theme?.messages?.error ?? DEFAULT_ERROR,
  };

  return { colors, symbols, messages };
}
