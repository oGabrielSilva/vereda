import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const config = defineCLI({
  name: 'spinner-demo',
  menu: [
    defineMenuItem({
      label: 'Long task',
      hint: 'simula trabalho com spinner',
      command: 'work',
      args: {
        fail: { type: 'boolean' },
      },
      action: async (ctx) => {
        const s = ctx.spinner('Iniciando...');
        await sleep(600);
        s.update('Processando...');
        await sleep(600);
        if (ctx.args.fail === true) {
          s.error('Falhou na metade do caminho.');
          throw new Error('Simulação de falha (--fail).');
        }
        s.update('Finalizando...');
        await sleep(400);
        s.success('Pronto.');
      },
    }),
  ],
});

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
