/**
 * Restore the terminal to a sane state: show the cursor and leave raw mode.
 *
 * Called in two places: at the top-level `catch` in `run` (when an error escapes),
 * and around each action in the interactive `loop` (so an action that opened its
 * own prompts cannot leave stdin in raw mode for the next menu render).
 */
export function restoreTerminal(): void {
  if (process.stdout.isTTY === true) {
    process.stdout.write('\x1B[?25h');
  }
  if (process.stdin.isTTY === true && typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(false);
  }
}
