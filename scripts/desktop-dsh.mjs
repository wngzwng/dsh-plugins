// macOS Desktop adapter. Run mutations from an external terminal with DSH closed.
// The ordinary Node process cannot open app.asar; delegate to the app's Electron Node.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const self = fileURLToPath(import.meta.url);
const contents = join(process.env.DSH_DESKTOP_APP || '/Applications/DeepSeek Harness.app', 'Contents');
const run = promisify(execFile);
async function invoke(op, value = '') {
  const exe = join(contents, 'MacOS', 'DeepSeek Harness');
  const { stdout } = await run(exe, [self, '--desktop-worker', op, value], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}
export const listBundles = () => invoke('list');
export const installBundle = spec => invoke('install', spec);
export const enableBundle = name => invoke('enable', name);

async function worker(op, value) {
  const installAnchor = join(contents, 'Resources', 'app.asar', 'dsh', 'package.json');
  const req = createRequire(installAnchor);
  const { Context } = req('@deepseek-ai/cordis');
  const dsh = req('@deepseek-ai/dsh-app-boot');
  const { PluginManager, default: plugin } = req('@deepseek-ai/dsh-plugin-manager');
  const home = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'));
  const dir = dsh.resolveProfileDir('desktop', home);
  const manifest = dsh.readProfileManifest('dsh', dir); // Never silently initialize another profile.
  if (!Array.isArray(manifest.dsh?.profile?.bundles)) throw Error('请先打开一次 DSH 桌面版，初始化 desktop profile。');
  const deps = join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies');
  const node = join(deps, 'node', 'bin', 'node');
  const pnpm = join(deps, 'pnpm', 'bin', 'pnpm.mjs');
  const profile = { name: 'desktop', dir, cwd: process.cwd(), home, installAnchor,
    startedBundles: [], overlays: [], patchPath: join(dir, 'cordis.patch.yml'),
    packageManager: { command: node, args: [pnpm], env: { PATH: `${dirname(node)}:${process.env.PATH || ''}` } },
  };
  // No profile plugins are mounted and no HMR is running. The actual DSH manager
  // handles the file lock, compatibility, build approval, selection and validation.
  const ctx = new Context();
  ctx.provide('loader', { entries: () => [] });
  ctx.provide('profileContext', profile);
  const manager = new PluginManager(ctx, plugin.Config({}));
  if (op === 'list') {
    const rows = await manager.listBundles();
    return rows.map(({ name, version, installed, enabled, optional, availability, error }) => ({
      name, version, installed, enabled, optional, availability, error,
      source: manifest.dependencies?.[name],
      packageName: installed && !error ? dsh.readProfileManifest('dsh', dsh.resolveBundleDir('dsh', name, installAnchor, dir)).name : undefined,
    }));
  }
  if (op !== 'install' && op !== 'enable') throw Error('不支持的管理操作');
  if (!value || value.startsWith('-')) throw Error('缺少或无效的插件名 / 安装来源');
  if (process.env.DSH_SESSION_ID) throw Error('请先退出 DSH，再从系统终端运行 --apply。');
  if (op === 'install') { await access(node); await access(pnpm); }
  const result = op === 'enable' ? await manager.setBundleEnabled(value, true) : await manager.installBundle(value);
  if (result.error || result.pendingBuilds?.length || !['applied', 'restart-required'].includes(result.application)) {
    throw Error(`DSH ${op} 失败：${JSON.stringify(result.error || result.application)}${result.pendingBuilds?.length ? `；需在 DSH 审核构建脚本：${result.pendingBuilds.join(', ')}` : ''}`);
  }
  return { changed: result.changed, application: result.application };
}

if (process.argv[1] && resolve(process.argv[1]) === self && process.argv[2] === '--desktop-worker') {
  try { console.log(JSON.stringify(await worker(process.argv[3], process.argv[4]))); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
