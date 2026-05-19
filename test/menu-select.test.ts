import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { resolveColorizer, isColorDisabled } from '../src/renderer/ansi.js';
import { renderMenuFrame, type MenuOption } from '../src/renderer/menu-select.js';
import { detectUnicodeSupport, resolveSymbols } from '../src/renderer/symbols.js';
import { applyTheme } from '../src/theme/apply.js';

const baseTheme = applyTheme(undefined);

function options(...labels: string[]): MenuOption<string>[] {
  return labels.map((label) => ({ value: label, label }));
}

describe('renderMenuFrame — states', () => {
  const opts = options('Build', 'Test', 'Deploy');

  it('initial state shows all options with cursor on first', () => {
    const frame = renderMenuFrame({
      state: 'initial',
      cursor: 0,
      options: opts,
      theme: baseTheme,
      message: 'Choose:',
    });
    const text = stripAnsi(frame);
    expect(text).toContain('Choose:');
    expect(text).toContain('Build');
    expect(text).toContain('Test');
    expect(text).toContain('Deploy');
  });

  it('active state with cursor at index 1 marks Test active', () => {
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 1,
      options: opts,
      theme: baseTheme,
      message: 'Choose:',
    });
    const text = stripAnsi(frame);
    const lines = text.split('\n');
    const testLine = lines.find((l) => l.includes('Test'));
    expect(testLine).toBeDefined();
    expect(testLine).toContain(baseTheme.symbols.active);
  });

  it('submit state shows selected option', () => {
    const frame = renderMenuFrame({
      state: 'submit',
      cursor: 2,
      options: opts,
      theme: baseTheme,
      message: 'Choose:',
    });
    const text = stripAnsi(frame);
    expect(text).toContain('Choose:');
    expect(text).toContain('Deploy');
    expect(text).toContain(baseTheme.symbols.success);
  });

  it('cancel state shows error symbol and cancelled hint', () => {
    const frame = renderMenuFrame({
      state: 'cancel',
      cursor: 0,
      options: opts,
      theme: baseTheme,
      message: 'Choose:',
    });
    const text = stripAnsi(frame);
    expect(text).toContain(baseTheme.symbols.error);
    expect(text).toContain('cancelado');
  });

  it('empty options shows fallback line', () => {
    const frame = renderMenuFrame({
      state: 'initial',
      cursor: 0,
      options: [],
      theme: baseTheme,
      message: 'Choose:',
    });
    expect(stripAnsi(frame)).toContain('sem opções');
  });
});

describe('renderMenuFrame — hint', () => {
  it('renders hint in parentheses next to label', () => {
    const frame = renderMenuFrame({
      state: 'initial',
      cursor: 0,
      options: [
        { value: 'a', label: 'A', hint: 'first' },
        { value: 'b', label: 'B' },
      ],
      theme: baseTheme,
      message: 'Pick:',
    });
    expect(stripAnsi(frame)).toContain('(first)');
  });
});

describe('renderMenuFrame — scroll window', () => {
  const many = options(...Array.from({ length: 10 }, (_, i) => `Item ${i}`));

  it('limits to maxItems when smaller than total', () => {
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 0,
      options: many,
      theme: baseTheme,
      message: 'Pick:',
      maxItems: 4,
    });
    const text = stripAnsi(frame);
    expect(text).toContain('Item 0');
    expect(text).toContain('Item 1');
    expect(text).not.toContain('Item 9');
  });

  it('shows "above" indicator when window is past the start', () => {
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 8,
      options: many,
      theme: baseTheme,
      message: 'Pick:',
      maxItems: 4,
    });
    expect(stripAnsi(frame)).toContain('acima');
  });

  it('shows "below" indicator when window is before the end', () => {
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 0,
      options: many,
      theme: baseTheme,
      message: 'Pick:',
      maxItems: 4,
    });
    expect(stripAnsi(frame)).toContain('abaixo');
  });
});

describe('renderMenuFrame — theme overrides', () => {
  it('uses custom symbols.active when provided', () => {
    const custom = applyTheme({ symbols: { active: '▸' } });
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 0,
      options: options('a', 'b'),
      theme: custom,
      message: 'Pick:',
    });
    expect(stripAnsi(frame)).toContain('▸');
  });

  it('applies custom Colorizer function to active label', () => {
    const wrap = (s: string): string => `<${s}>`;
    const custom = applyTheme({ colors: { primary: wrap } });
    const frame = renderMenuFrame({
      state: 'active',
      cursor: 0,
      options: options('alpha', 'beta'),
      theme: custom,
      message: 'Pick:',
    });
    expect(frame).toContain('<alpha');
  });
});

describe('resolveColorizer — NO_COLOR', () => {
  it('returns identity when NO_COLOR is set', () => {
    const fn = resolveColorizer('red', undefined, { NO_COLOR: '1' });
    expect(fn('hello')).toBe('hello');
  });

  it('returns identity for Colorizer function when NO_COLOR set', () => {
    const wrap = (s: string): string => `[${s}]`;
    const fn = resolveColorizer(wrap, undefined, { NO_COLOR: '1' });
    expect(fn('x')).toBe('x');
  });

  it('isColorDisabled detects NO_COLOR=1', () => {
    expect(isColorDisabled({ NO_COLOR: '1' })).toBe(true);
  });

  it('isColorDisabled false when NO_COLOR is undefined', () => {
    expect(isColorDisabled({})).toBe(false);
  });

  it('isColorDisabled false when NO_COLOR is empty string', () => {
    expect(isColorDisabled({ NO_COLOR: '' })).toBe(false);
  });
});

describe('resolveSymbols — Unicode fallback', () => {
  it('returns Unicode set when terminal supports it', () => {
    const symbols = resolveSymbols(undefined, { TERM: 'xterm-256color' });
    expect(symbols.active).toBe('●');
  });

  it('returns ASCII fallback for TERM=dumb', () => {
    const symbols = resolveSymbols(undefined, { TERM: 'dumb' });
    expect(symbols.active).toBe('>');
  });

  it('returns ASCII fallback when VEREDA_NO_UNICODE is set', () => {
    const symbols = resolveSymbols(undefined, { VEREDA_NO_UNICODE: '1' });
    expect(symbols.active).toBe('>');
  });

  it('custom symbol overrides default while undefined slots fall back', () => {
    const symbols = resolveSymbols({ active: '▸' }, { TERM: 'xterm-256color' });
    expect(symbols.active).toBe('▸');
    expect(symbols.inactive).toBe('◯');
  });
});

describe('detectUnicodeSupport', () => {
  it('false for TERM=linux', () => {
    expect(detectUnicodeSupport({ TERM: 'linux' })).toBe(false);
  });

  it('true for missing TERM', () => {
    expect(detectUnicodeSupport({})).toBe(true);
  });
});
