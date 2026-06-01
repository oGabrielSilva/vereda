# Examples

Run from the project root.

## Flagship

```sh
yarn example:devbox
```

A multi-purpose dev helper. The closest thing to "what a real vereda-cli CLI looks like":

- **3 levels** of menu nesting (`Git → Stash → List/Push`)
- **12 leaf actions** across **4 submenus**
- mix of all arg types: boolean (`--watch`, `--dry`, `--oneline`, `--deep`), required string (`--message`, `--bump`), optional string (`--filter`, `--tag`, `--limit`), string with default (`--limit=10`, `--tag=latest`), required enum (`--bump`), optional enum (`--target`)
- **real shell exec** for read-only ops: `git status`, `git log`, `git branch`, `npm outdated`
- **simulated exec** for destructive ops (publish, clean, stash push) — every one gated by `ctx.confirm`
- **full theme**: colors, symbols, messages, key aliases
- uses `ctx.log.{info, warn, error}`, `ctx.spinner` happy + error paths, `ctx.confirm`
- real `package.json` parsing for `Project → Info` and `Project → Scripts`

Try it both ways:

```sh
yarn example:devbox                                # menu (TTY) or help (non-TTY)
yarn example:devbox project:info
yarn example:devbox git:log --limit 5 --oneline
yarn example:devbox release:prepare --bump minor --dry
yarn example:devbox release:publish --dry
yarn example:devbox outdated
yarn example:devbox project:scripts --filter example
```

## Minimal references

Smaller, single-concern examples — useful when learning the API:

```sh
yarn example:basic     # 3 items, no args, trivial actions
yarn example:spinner   # one action, spinner success/error paths
yarn example:argv      # argv-only mode with enum + required args
yarn example:themed    # custom colors + symbols
```

Each script imports from `../src/define-cli.ts` for development convenience. In a real consumer project you would install vereda-cli from npm and import from `'vereda-cli'`.
