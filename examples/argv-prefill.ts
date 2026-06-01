import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

// Demonstrates the v0.2 catch-22 fix: an optional arg declared in the schema is
// accepted from argv (and pre-fills the leaf in the interactive menu without
// prompting). Run interactively with `zip --path X` in argv: pick "Zip" and the
// action runs immediately, logging the provided path — no prompt.
const config = defineCLI({
  name: 'argv-prefill',
  strict: false,
  menu: [
    defineMenuItem({
      label: 'Zip',
      command: 'zip',
      args: { path: { type: 'string' } }, // optional → never prompted
      action: (ctx) => {
        ctx.log.info(`zip path=${ctx.args.path ?? '(none)'} positionals=${ctx._.join(',')}`);
      },
    }),
    defineMenuItem({
      label: 'Status',
      command: 'status',
      action: (ctx) => {
        ctx.log.info('status ok');
      },
    }),
  ],
});

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
