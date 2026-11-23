import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const snapshot = json(join(root, 'profiles/desktop-plugins.json'));

function source(p, archiveDir) {
  if (p.archive) {
    const path = resolve(archiveDir, p.archive);
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hash !== p.sha256) throw Error(`SHA-256 不匹配：${path}`);
    return `file:${path}`;
  }
  if (p.dir) {
    const path = resolve(root, p.dir);
    const pkg = json(join(path, 'package.json'));
    if (pkg.name !== (p.packageName ?? p.name) || pkg.version !== p.version)
      throw Error(`目录实际为 ${pkg.name}@${pkg.version}：${path}`);
    return `${pkg.name}@link:${path}`;
  }
  return `${p.name}@${p.version}`;
}

// Both the recorded profile alias and the package's current name identify a local bundle.
function inspect(p, rows) {
  const matches = rows.filter(r => (r.name === p.name || r.name === p.packageName) && (r.installed || r.availability === 'installation'));
  if (matches.length > 1) throw Error('包名与别名同时存在，请先确认保留哪一个');
  const row = matches[0];
  if (row?.error) throw Error(`DSH 报告该插件有错误：${JSON.stringify(row.error)}`);
  if (!p.version && (!row || !row.optional || row.availability !== 'installation')) throw Error('当前 DSH 不提供这个内置可选扩展');
  if (!row) return {action: 'install'};
  if (p.version && (!row.installed || row.version !== p.version)) throw Error(`实际 ${row.version}，快照 ${p.version}；不自动替换`);
  return {action: row.enabled ? 'skip' : 'enable', name: row.name};
}

export async function restore(api, { manifest = snapshot, apply = false, archiveDir = join(root, 'vendor'), log = console.log } = {}) {
  const rows = await api.listBundles();
  const plan = [...manifest.enabledBundles, ...manifest.enabledBuiltins].map(p => {
    try {
      const step = inspect(p, rows);
      if (step.action === 'install') step.spec = source(p, archiveDir);
      return {p, ...step};
    } catch (e) { return {p, action: 'blocked', reason: e.message}; }
  });
  for (const s of plan) log(`${s.action.padEnd(8)} ${s.p.name}${s.p.version ? '@' + s.p.version : ''}${s.spec ? ' ← ' + s.spec : ''}${s.reason ? ' — ' + s.reason : ''}`);
  if (plan.some(s => s.action === 'blocked')) throw Error('预检未通过，本次没有安装或启用任何插件。');
  const pending = plan.filter(s => s.action !== 'skip');
  log(`${plan.length - pending.length} 项已满足，${pending.length} 项待处理。`);
  if (!apply || !pending.length) return;
  for (const s of pending) {
    let state = inspect(s.p, await api.listBundles());
    if (state.action === 'install') {
      await api.installBundle(source(s.p, archiveDir));
      state = inspect(s.p, await api.listBundles());
    }
    if (state.action === 'enable') await api.enableBundle(state.name);
    if (inspect(s.p, await api.listBundles()).action !== 'skip') throw Error(`回读未确认 ${s.p.name} 安装且启用，已停止。`);
    log(`OK       ${s.p.name}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { apply: {type:'boolean'}, 'archive-dir': {type:'string'}, help: {type:'boolean'} } });
    if (values.help) console.log('node scripts/restore-desktop.mjs [--apply] [--archive-dir <原始 tgz 所在目录>]\n默认仅预览 desktop 配置；不升级、降级或卸载。');
    else await restore(await import('./desktop-dsh.mjs'), { apply: values.apply, archiveDir: values['archive-dir'] });
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
