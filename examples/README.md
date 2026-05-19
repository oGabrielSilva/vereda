# Examples

Each file in this folder is a runnable demonstration of vereda. Run from the project root with:

```sh
yarn example:basic     # Hierarchical menu with submenu, no args
yarn example:spinner   # Spinner with success/error states, optional --fail flag
yarn example:argv      # argv-only mode: type-safe enum + required args, no menu
yarn example:themed    # Custom theme: colors, symbols, messages
```

Each script imports from `../src/define-cli.ts` for development convenience. In a real consumer project you would install vereda from npm and import from `'vereda'` instead.

## Behavior matrix

| Example         | Mode             | Interactive | argv                          |
| --------------- | ---------------- | ----------- | ----------------------------- |
| `basic`         | auto (default)   | menu        | `basic build`                 |
| `with-spinner`  | auto             | menu        | `with-spinner work --fail`    |
| `argv-router`   | argv-only        | n/a         | `argv-router deploy --env prod` |
| `themed`        | auto             | menu        | `themed hello`                |
