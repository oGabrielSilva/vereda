/**
 * Flagship vereda demo: a multi-purpose dev helper.
 *
 * Demonstrates:
 *   - Three-level menu tree with mixed branches and leaves at each level
 *   - Required + optional args across all three types (boolean, string, enum)
 *   - String defaults via the `default` field
 *   - Full theme palette (colors + symbols + messages + keyAliases)
 *   - ctx.confirm gating destructive flows
 *   - ctx.spinner happy + error paths
 *   - ctx.log.{info,warn,error} for structured output
 *   - Real shell exec for read-only ops (git, npm)
 *   - Simulated exec for destructive ops (publish, rm) — guarded by confirm
 */

import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { defineCLI, defineMenuItem, run } from '../src/define-cli.js';

const sh = promisify(exec);

async function runShell(cmd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await sh(cmd, { maxBuffer: 4 * 1024 * 1024 });
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Shell falhou: ${cmd}\n${message}`, { cause: err });
  }
}

async function readPackageJson(): Promise<{
  name: string;
  version: string;
  scripts: Record<string, string>;
  deps: string[];
  devDeps: string[];
}> {
  const raw = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const pkg = JSON.parse(raw) as {
    name: string;
    version: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return {
    name: pkg.name,
    version: pkg.version,
    scripts: pkg.scripts ?? {},
    deps: Object.keys(pkg.dependencies ?? {}),
    devDeps: Object.keys(pkg.devDependencies ?? {}),
  };
}

const config = defineCLI({
  name: 'devbox',
  theme: {
    messages: {
      cancel: 'Operação interrompida.',
      error: 'Falhou ao executar a ação.',
    },
    keyAliases: { w: 'up', s: 'down', a: 'left', d: 'right' },
    colors: {
      primary: 'cyan',
      success: 'green',
      error: 'red',
      warning: 'yellow',
      dimmed: 'gray',
    },
    symbols: { active: '▸', inactive: '·' },
  },

  menu: [
    defineMenuItem({
      label: 'Build',
      hint: 'compila o pacote',
      command: 'build',
      args: {
        watch: { type: 'boolean' },
        target: { type: 'enum', options: ['node18', 'node20', 'node22'], required: false },
      },
      action: async (ctx) => {
        const target = ctx.args.target ?? 'node18';
        const s = ctx.spinner(`Compilando para ${target}${ctx.args.watch === true ? ' (watch)' : ''}...`);
        await new Promise((r) => setTimeout(r, 800));
        s.success(`Build concluído (${target}).`);
        if (ctx.args.watch === true) {
          ctx.log.info('Em modo watch — ficaria escutando mudanças (simulado).');
        }
      },
    }),

    {
      label: 'Project',
      hint: 'inspeção de metadados',
      children: [
        defineMenuItem({
          label: 'Info',
          command: 'project:info',
          action: async (ctx) => {
            const s = ctx.spinner('Lendo package.json...');
            const pkg = await readPackageJson();
            s.success('package.json lido.');
            ctx.log.info(`Pacote: ${pkg.name}@${pkg.version}`);
            ctx.log.info(`Scripts:     ${Object.keys(pkg.scripts).length}`);
            ctx.log.info(`Deps:        ${pkg.deps.length}`);
            ctx.log.info(`Dev deps:    ${pkg.devDeps.length}`);
          },
        }),
        defineMenuItem({
          label: 'Scripts',
          hint: 'lista os scripts npm',
          command: 'project:scripts',
          args: {
            filter: { type: 'string', required: false },
          },
          action: async (ctx) => {
            const pkg = await readPackageJson();
            const entries = Object.entries(pkg.scripts);
            const filter = ctx.args.filter;
            const filtered = filter !== undefined ? entries.filter(([k]) => k.includes(filter)) : entries;
            if (filtered.length === 0) {
              ctx.log.warn('Nenhum script encontrado.');
              return;
            }
            const max = Math.max(...filtered.map(([k]) => k.length));
            for (const [name, body] of filtered) {
              ctx.log.info(`${name.padEnd(max + 2)}${body}`);
            }
          },
        }),
      ],
    },

    {
      label: 'Git',
      hint: 'inspeciona o repositório',
      children: [
        defineMenuItem({
          label: 'Status',
          command: 'git:status',
          action: async (ctx) => {
            const s = ctx.spinner('Executando git status...');
            const { stdout } = await runShell('git status -sb');
            s.stop();
            const lines = stdout.split('\n').filter((l) => l.length > 0);
            if (lines.length <= 1) {
              ctx.log.info('Working tree limpa.');
              return;
            }
            for (const line of lines) ctx.log.info(line);
          },
        }),
        defineMenuItem({
          label: 'Branches',
          command: 'git:branches',
          action: async (ctx) => {
            const { stdout } = await runShell('git branch --list');
            for (const line of stdout.split('\n').filter((l) => l.length > 0)) {
              ctx.log.info(line);
            }
          },
        }),
        defineMenuItem({
          label: 'Log',
          hint: 'últimos commits',
          command: 'git:log',
          args: {
            limit: { type: 'string', default: '10' },
            oneline: { type: 'boolean' },
          },
          action: async (ctx) => {
            const limit = Number.parseInt(ctx.args.limit ?? '10', 10);
            if (Number.isNaN(limit) || limit <= 0) {
              ctx.log.error('--limit precisa ser um inteiro positivo.');
              return;
            }
            const flags = ctx.args.oneline === true ? '--oneline' : '--abbrev-commit --date=short';
            const { stdout } = await runShell(`git log ${flags} -n ${limit}`);
            for (const line of stdout.split('\n').filter((l) => l.length > 0)) {
              ctx.log.info(line);
            }
          },
        }),
        {
          label: 'Stash',
          children: [
            defineMenuItem({
              label: 'List',
              command: 'git:stash:list',
              action: async (ctx) => {
                const { stdout } = await runShell('git stash list');
                if (stdout.trim().length === 0) {
                  ctx.log.info('Stash vazia.');
                  return;
                }
                for (const line of stdout.split('\n').filter((l) => l.length > 0)) {
                  ctx.log.info(line);
                }
              },
            }),
            defineMenuItem({
              label: 'Push',
              hint: 'simulação — não modifica o repo',
              command: 'git:stash:push',
              args: {
                message: { type: 'string', required: true },
              },
              action: async (ctx) => {
                const ok = await ctx.confirm({
                  message: `Stashar com mensagem "${ctx.args.message}"?`,
                  initialValue: false,
                });
                if (!ok) {
                  ctx.log.warn('Cancelado.');
                  return;
                }
                ctx.log.info(`(simulado) git stash push -m "${ctx.args.message}"`);
              },
            }),
          ],
        },
      ],
    },

    {
      label: 'Release',
      hint: 'fluxo de release (simulado)',
      children: [
        defineMenuItem({
          label: 'Prepare',
          hint: 'calcula a próxima versão',
          command: 'release:prepare',
          args: {
            bump: { type: 'enum', options: ['patch', 'minor', 'major'], required: true },
            dry: { type: 'boolean' },
            tag: { type: 'string', required: false },
          },
          action: async (ctx) => {
            const pkg = await readPackageJson();
            const next = bumpVersion(pkg.version, ctx.args.bump);
            ctx.log.info(`Versão atual:   ${pkg.version}`);
            ctx.log.info(`Próxima versão: ${next}${ctx.args.tag !== undefined ? ` (tag: ${ctx.args.tag})` : ''}`);

            if (ctx.args.dry === true) {
              ctx.log.warn('Dry run — nenhuma mudança aplicada.');
              return;
            }

            const ok = await ctx.confirm({
              message: `Aplicar bump para ${next}?`,
              initialValue: false,
            });
            if (!ok) {
              ctx.log.warn('Bump abortado pelo usuário.');
              return;
            }

            const s = ctx.spinner('Aplicando bump...');
            await new Promise((r) => setTimeout(r, 500));
            s.success(`Bump para ${next} aplicado (simulado).`);
          },
        }),
        defineMenuItem({
          label: 'Publish',
          hint: 'publica no npm (simulado)',
          command: 'release:publish',
          args: {
            tag: { type: 'string', default: 'latest' },
            dry: { type: 'boolean' },
          },
          action: async (ctx) => {
            const pkg = await readPackageJson();
            ctx.log.info(`Publicando ${pkg.name}@${pkg.version} com tag "${ctx.args.tag ?? 'latest'}".`);

            if (ctx.args.dry === true) {
              ctx.log.warn('Dry run — npm publish não foi chamado.');
              return;
            }

            const ok = await ctx.confirm({
              message: `Publicar ${pkg.name}@${pkg.version} no npm?`,
              initialValue: false,
            });
            if (!ok) {
              ctx.log.warn('Publish cancelado.');
              return;
            }

            const s = ctx.spinner('Empacotando...');
            await new Promise((r) => setTimeout(r, 600));
            s.update('Subindo para o registry...');
            await new Promise((r) => setTimeout(r, 600));
            s.success(`(simulado) Publicado ${pkg.name}@${pkg.version}.`);
          },
        }),
      ],
    },

    {
      label: 'Maintenance',
      hint: 'limpeza e auditoria',
      children: [
        defineMenuItem({
          label: 'Clean',
          hint: 'remove artefatos de build',
          command: 'clean',
          args: {
            deep: { type: 'boolean' },
          },
          action: async (ctx) => {
            const targets = ['dist/', '.tsbuildinfo'];
            if (ctx.args.deep === true) targets.push('node_modules/');

            ctx.log.info(`Alvos: ${targets.join(', ')}`);

            const ok = await ctx.confirm({
              message: ctx.args.deep === true ? 'Remover TUDO (incluindo node_modules)?' : 'Remover artefatos de build?',
              initialValue: false,
            });
            if (!ok) {
              ctx.log.warn('Cancelado.');
              return;
            }

            const s = ctx.spinner('Limpando...');
            await new Promise((r) => setTimeout(r, 400));
            s.success(`(simulado) Removeria: ${targets.join(', ')}`);
          },
        }),
        defineMenuItem({
          label: 'Outdated',
          hint: 'lista deps desatualizadas',
          command: 'outdated',
          action: async (ctx) => {
            const s = ctx.spinner('Consultando registry...');
            try {
              const { stdout } = await runShell('npm outdated --json');
              s.stop();
              const data = JSON.parse(stdout === '' ? '{}' : stdout) as Record<string, { current?: string; latest?: string }>;
              const entries = Object.entries(data);
              if (entries.length === 0) {
                ctx.log.info('Tudo atualizado.');
                return;
              }
              ctx.log.warn(`${entries.length} pacotes desatualizados:`);
              for (const [name, info] of entries) {
                ctx.log.info(`  ${name.padEnd(28)} ${info.current ?? '?'} -> ${info.latest ?? '?'}`);
              }
            } catch (err) {
              s.error('Falhou ao rodar npm outdated.');
              const msg = err instanceof Error ? err.message : String(err);
              ctx.log.error(msg);
            }
          },
        }),
      ],
    },
  ],
});

function bumpVersion(current: string, kind: 'patch' | 'minor' | 'major'): string {
  const parts = current.split('.').map((n) => Number.parseInt(n, 10));
  const [major = 0, minor = 0, patch = 0] = parts;
  switch (kind) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

const exitCode = await run(config, process.argv.slice(2));
process.exit(exitCode);
