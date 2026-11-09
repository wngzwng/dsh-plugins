import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostService } from '../knowledge-tree/host-service.js';

// End-to-end through the real Host service, the real git binary and a real (local) remote.
// The GitHub SSH URL is rewritten to the local bare repository with git's url.insteadOf,
// so no network or SSH credentials are required by this test.
const SSH_REMOTE = 'git@github.com:e2e/ssh-remote.git';

function git(args, cwd) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'kt-host-ssh-'));
  const remote = join(root, 'remote.git');
  git(['init', '--bare', '-q', remote]);
  const seed = join(root, 'seed');
  git(['init', '-q', seed]);
  await writeFile(join(seed, 'README.md'), '# repo\n');
  git(['add', '-A'], seed);
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '-m', 'seed'], seed);
  git(['remote', 'add', 'origin', remote], seed);
  git(['push', '-q', 'origin', 'HEAD:refs/heads/main'], seed);
  const environment = {
    DSH_HOME: join(root, 'dsh'),
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${remote}.insteadOf`,
    GIT_CONFIG_VALUE_0: SSH_REMOTE,
  };
  return { root, remote, environment, configPath: join(root, 'host', 'config.json') };
}

const config = { remote: SSH_REMOTE, branch: 'main', directory: 'trees' };
const document = (title) => ({
  version: 3, stage: 'brainstorm', title,
  cards: [{ id: 'c', title: '卡片', content: '正文', placed: true, order: 0, createdAt: 1, image: null }],
  links: [], updatedAt: 1,
});

test('Host configures SSH sync, checks the connection and pushes a tree with real git', async () => {
  const { environment, configPath, remote } = await setup();
  const service = createHostService({ configPath, environment });
  const configured = await service.call('configure', config);
  assert.equal(configured.configured, true);
  assert.equal(configured.transport, 'ssh');
  assert.deepEqual(configured.config, config);
  assert.equal(typeof configured.gitAvailable, 'boolean');

  const checked = await service.call('check', {});
  assert.equal(checked.ok, true);
  assert.match(checked.commitSha, /^[0-9a-f]{40}$/);

  assert.deepEqual(await service.call('listTrees', {}), []);
  const pushed = await service.call('pushTree', { treeId: 't1', document: document('第一版'), baseHash: null });
  assert.equal(pushed.noOp, false);
  assert.match(pushed.commitSha, /^[0-9a-f]{40}$/);

  const listed = await service.call('listTrees', {});
  assert.deepEqual(listed.map((item) => item.treeId), ['t1']);
  const read = await service.call('readTree', { treeId: 't1' });
  assert.equal(read.document.title, '第一版');
  assert.equal(read.hash, pushed.hash);

  const pushedFiles = git(['-C', remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main']).split('\n');
  assert.ok(pushedFiles.includes('trees/t1/tree.json'));
  assert.ok(pushedFiles.includes('trees/t1/tree.md'));

  // stale base is rejected and the remote keeps the previous version
  await assert.rejects(
    () => service.call('pushTree', { treeId: 't1', document: document('第二版'), baseHash: null }),
    { code: 'CONFLICT' },
  );
  assert.equal((await service.call('readTree', { treeId: 't1' })).document.title, '第一版');
});

test('Host reports a clear error for an unreachable SSH remote', async () => {
  const { environment, configPath, root } = await setup();
  const service = createHostService({ configPath, environment });
  // Point at a path that does not exist; git maps it to a fatal error, not a hang.
  const broken = { remote: SSH_REMOTE, branch: 'main', directory: 'trees' };
  await service.call('configure', broken);
  const missing = join(root, 'does-not-exist', 'repo.git');
  const service2 = createHostService({
    configPath: join(root, 'host', 'config2.json'),
    environment: { ...environment, GIT_CONFIG_VALUE_0: missing },
  });
  await service2.call('configure', broken);
  await assert.rejects(() => service2.call('check', {}), (error) => ['NOT_FOUND', 'GIT_ERROR', 'NETWORK', 'SSH_AUTH'].includes(error.code));
});
