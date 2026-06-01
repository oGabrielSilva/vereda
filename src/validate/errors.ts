export type ConfigErrorCode =
  | 'duplicate_command'
  | 'empty_children'
  | 'invalid_leaf'
  | 'args_without_action'
  | 'reserved_command'
  | 'deep_nesting'
  | 'invalid_color'
  | 'invalid_symbol'
  | 'required_never_prompted';

/**
 * Structured error for config validation failures.
 *
 * `path` traces the offending node by `label` from the menu root, so
 * consumers can pinpoint which leaf/branch is invalid.
 */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';

  constructor(
    readonly code: ConfigErrorCode,
    readonly path: readonly string[],
    message: string,
  ) {
    super(message);
  }
}
