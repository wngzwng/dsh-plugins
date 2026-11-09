import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitSync, validateGitConfig } from '../knowledge-tree/git-sync.js';
import { canonicalDocumentHash } from '../knowledge-tree/github-sync.js';

const SSH_REMOTE = 'git@github.com:owner/repo.git';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const doc = (title, extra = {}) => ({
  version: 3, stage: 'brainstorm', title,
  cards: [{ id: 'card', title: '卡片', content: '正文 ' + title, image: null, placed: true, order: 0, createdAt: 1 }],
  links: [], ...extra,
});
const imageDoc = (title) => doc(title, {
  cards: [{ id: 'card', title: '带图', content: '', image: { data: 'data:image/png;base64,' + PNG, mime: 'image/png', w: 1, h: 1 }, placed: true, order: 0, createdAt: 1 }],
});

function git(args, cwd) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }

async function setupRemote() {
  const root = await mkdtemp(join(tmpdir(), 'kt-git-'));
  const remote = join(root, 'remote.git');
  git(['init', '--bare', '-q', remote]);
  const seed = join(root, 'seed');
  git(['init', '-q', seed]);
  git(['config', 'user.name', 'test'], seed);
  git(['config', 'user.email', 'test@example.com'], seed);
  await writeFile(join(seed, 'README.md'), '# repo\n');
  git(['add', '-A'], seed);
  git(['commit', '-q', '-m', 'seed'], seed);
  git(['remote', 'add', 'origin', remote], seed);
  git(['push', '-q', 'origin', 'HEAD:refs/heads/main'], seed);
  const environment = {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${remote}.insteadOf`,
    GIT_CONFIG_VALUE_0: SSH_REMOTE,
  };
  return { root, remote, seed, environment };
}

function connector(setup, config = { remote: SSH_REMOTE, branch: 'main', directory: 'trees' }) {
  return createGitSync({ getConfig: async () => config, cacheRoot: join(setup.root, 'cache'), environment: setup.environment });
}

test('validates the SSH remote, branch and directory', () => {
  assert.deepEqual(validateGitConfig({ remote: SSH_REMOTE, branch: 'main', directory: 'trees' }), { remote: SSH_REMOTE, branch: 'main', directory: 'trees' });
  assert.deepEqual(validateGitConfig({ remote: 'ssh://git@github.com/owner/repo.git', branch: 'main', directory: 'a/b' }), { remote: 'ssh://git@github.com/owner/repo.git', branch: 'main', directory: 'a/b' });
  for (const bad of [
    { remote: 'https://github.com/owner/repo.git' },
    { remote: 'git@gitlab.com:owner/repo.git' },
    { remote: SSH_REMOTE, branch: '../main' },
    { remote: SSH_REMOTE, directory: '../oops' },
    { remote: SSH_REMOTE, directory: '/root' },
  ]) {
    assert.throws(() => validateGitConfig({ ...bad, branch: bad.branch || 'main', directory: bad.directory || 'trees' }), { code: 'INVALID_CONFIG' });
  }
});

test('push creates the tree on the remote branch and read returns the same hash', async () => {
  const setup = await setupRemote();
  const sync = connector(setup);
  assert.deepEqual(await sync.listTrees(), []);

  const pushed = await sync.pushTree({ treeId: 'a', document: doc('第一版'), baseHash: null, message: 'add a' });
  assert.equal(pushed.noOp, false);
  assert.match(pushed.commitSha, /^[0-9a-f]{40}$/);
  assert.equal(pushed.hash, canonicalDocumentHash(doc('第一版')));

  const read = await sync.readTree('a');
  assert.equal(read.hash, pushed.hash);
  assert.equal(read.document.title, '第一版');

  const listed = await sync.listTrees();
  assert.deepEqual(listed.map((item) => item.treeId), ['a']);
  assert.equal(listed[0].title, '第一版');

  assert.equal(git(['-C', setup.remote, 'log', '--format=%s', 'refs/heads/main']).split('\n')[0], 'add a');
  const paths = git(['-C', setup.remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main']).split('\n');
  assert.ok(paths.includes('trees/a/tree.json'));
  assert.ok(paths.includes('trees/a/tree.md'));
  assert.ok(paths.includes('README.md'), 'unrelated repository files must be preserved');
});

test('unchanged push is a no-op; stale base is rejected without overwriting', async () => {
  const setup = await setupRemote();
  const sync = connector(setup);
  const first = await sync.pushTree({ treeId: 'a', document: doc('一'), baseHash: null });
  const again = await sync.pushTree({ treeId: 'a', document: doc('一'), baseHash: first.hash });
  assert.equal(again.noOp, true);
  assert.equal(again.commitSha, first.commitSha);

  await assert.rejects(
    () => sync.pushTree({ treeId: 'a', document: doc('二'), baseHash: null }),
    { code: 'CONFLICT' },
  );
  const read = await sync.readTree('a');
  assert.equal(read.document.title, '一');
});

test('images are stored as content-addressed assets, hydrated on read and pruned when removed', async () => {
  const setup = await setupRemote();
  const sync = connector(setup);
  const pushed = await sync.pushTree({ treeId: 'img', document: imageDoc('有图'), baseHash: null });
  const read = await sync.readTree('img');
  assert.equal(read.hash, pushed.hash);
  assert.equal(read.document.cards[0].image.data, 'data:image/png;base64,' + PNG);

  const assets = git(['-C', setup.remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main']).split('\n').filter((p) => p.includes('/assets/'));
  assert.equal(assets.length, 1);
  const sha = assets[0].split('/').pop().split('.')[0];
  assert.match(sha, /^[0-9a-f]{64}$/);

  const plain = await sync.pushTree({ treeId: 'img', document: doc('无图'), baseHash: pushed.hash });
  const after = git(['-C', setup.remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main']).split('\n').filter((p) => p.includes('/assets/'));
  assert.deepEqual(after, []);
  assert.equal((await sync.readTree('img')).hash, plain.hash);
});

test('missing branch or tree is NOT_FOUND and a partial upload is INVALID_REMOTE', async () => {
  const setup = await setupRemote();
  const missingBranch = connector(setup, { remote: SSH_REMOTE, branch: 'nope', directory: 'trees' });
  await assert.rejects(() => missingBranch.listTrees(), { code: 'NOT_FOUND' });

  const sync = connector(setup);
  await assert.rejects(() => sync.readTree('missing'), { code: 'NOT_FOUND' });

  const work = join(setup.root, 'work2');
  git(['clone', '-q', setup.remote, work]);
  await mkdir(join(work, 'trees', 'partial'), { recursive: true });
  await writeFile(join(work, 'trees', 'partial', 'tree.md'), 'partial\n');
  git(['add', '-A'], work);
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '-m', 'partial'], work);
  git(['push', '-q', 'origin', 'HEAD:refs/heads/main'], work);
  await assert.rejects(() => sync.listTrees(), { code: 'INVALID_REMOTE' });
});

test('a remote tree changed by someone else is rejected, never overwritten', async () => {
  const setup = await setupRemote();
  const sync = connector(setup);
  const first = await sync.pushTree({ treeId: 'a', document: doc('一'), baseHash: null });

  const work = join(setup.root, 'work3');
  git(['clone', '-q', setup.remote, work]);
  const file = join(work, 'trees', 'a', 'tree.json');
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  envelope.document.title = '二';
  await writeFile(file, JSON.stringify(envelope) + '\n');
  git(['add', '-A'], work);
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '-m', 'remote edit'], work);
  git(['push', '-q', 'origin', 'HEAD:refs/heads/main'], work);

  await assert.rejects(
    () => sync.pushTree({ treeId: 'a', document: doc('三'), baseHash: first.hash }),
    { code: 'CONFLICT' },
  );
  assert.equal((await sync.readTree('a')).document.title, '二');
  await assert.rejects(
    () => sync.pushTree({ treeId: 'a', document: doc('三'), baseHash: null }),
    { code: 'CONFLICT' },
  );
});

test('check reports connectivity and a missing git binary fails clearly', async () => {
  const setup = await setupRemote();
  const sync = connector(setup);
  const result = await sync.check();
  assert.equal(result.ok, true);
  assert.match(result.commitSha, /^[0-9a-f]{40}$/);

  const broken = createGitSync({
    getConfig: async () => ({ remote: SSH_REMOTE, branch: 'main', directory: 'trees' }),
    cacheRoot: join(setup.root, 'cache2'),
    environment: setup.environment,
    git: '/nonexistent/git',
  });
  await assert.rejects(() => broken.check(), { code: 'GIT_MISSING' });
});
