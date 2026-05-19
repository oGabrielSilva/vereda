import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

const config = defineCLI({
  name: 'themed-demo',
  theme: {
    messages: { cancel: 'Operação cancelada pelo usuário.' },
    colors: {
      primary: 'magenta',
      success: 'green',
      error: 'red',
      dimmed: 'gray',
    },
    symbols: {
      active: '▸',
      inactive: '·',
    },
  },
  menu: [
    defineMenuItem({
      label: 'Hello',
      hint: 'ação simples',
      command: 'hello',
      action: (ctx) => {
        ctx.log.info('Hello from a themed vereda CLI.');
      },
    }),
    defineMenuItem({
      label: 'Bye',
      command: 'bye',
      action: (ctx) => {
        ctx.log.info('Tchau.');
      },
    }),
  ],
});

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
