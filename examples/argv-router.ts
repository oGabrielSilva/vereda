import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

const config = defineCLI({
  name: 'router-demo',
  mode: 'argv-only',
  menu: [
    defineMenuItem({
      label: 'Deploy',
      command: 'deploy',
      args: {
        env: { type: 'enum', options: ['prod', 'staging', 'dev'], required: true },
        dry: { type: 'boolean' },
      },
      action: (ctx) => {
        ctx.log.info(`Deploying to ${ctx.args.env}${ctx.args.dry === true ? ' (dry)' : ''}.`);
      },
    }),
    defineMenuItem({
      label: 'Rollback',
      command: 'rollback',
      args: {
        version: { type: 'string', required: true },
      },
      action: (ctx) => {
        ctx.log.info(`Rolling back to ${ctx.args.version}.`);
      },
    }),
  ],
});

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
