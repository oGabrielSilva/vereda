import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

const config = defineCLI({
  name: 'basic',
  menu: [
    defineMenuItem({
      label: 'Build',
      command: 'build',
      action: (ctx) => {
        ctx.log.info('Building...');
      },
    }),
    defineMenuItem({
      label: 'Test',
      hint: 'unit + integration',
      command: 'test',
      action: (ctx) => {
        ctx.log.info('Running tests...');
      },
    }),
    {
      label: 'Settings',
      children: [
        defineMenuItem({
          label: 'Show version',
          command: 'settings:version',
          action: (ctx) => {
            ctx.log.info('Version 0.0.x');
          },
        }),
      ],
    },
  ],
});

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
