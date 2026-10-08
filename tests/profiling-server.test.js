import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { startProfilingServer } from '../scripts/profiling-server.mjs';

test('profiling owns its server even when the previous default port serves another application', async () => {
  const cacheRoot = resolve('.cache/cr-pr2/profile-server-tests');
  await mkdir(cacheRoot, { recursive: true });
  const root = await mkdtemp(join(cacheRoot, 'fixture-'));
  await writeFile(join(root, 'index.html'), '<title>owned-profiling-fixture</title>');
  const foreign = createServer((_request, response) => response.end('foreign-application'));
  let profile;
  try {
    await new Promise((resolve, reject) => {
      foreign.once('error', reject);
      foreign.listen(5174, '127.0.0.1', resolve);
    });
    profile = await startProfilingServer({ root });
    assert.notEqual(new URL(profile.url).port, '5174', 'profiling must choose its own listening port');
    assert.match(await (await fetch(profile.url)).text(), /owned-profiling-fixture/);
    assert.equal(await (await fetch('http://127.0.0.1:5174')).text(), 'foreign-application');
    const ownedURL = profile.url;
    await profile.close();
    profile = undefined;
    await assert.rejects(fetch(ownedURL), 'closing the profiler must release its own HTTP server');
    assert.equal(await (await fetch('http://127.0.0.1:5174')).text(), 'foreign-application', 'the foreign server remains untouched');
  } finally {
    await profile?.close();
    if (foreign.listening) await new Promise((resolve, reject) => foreign.close(error => error ? reject(error) : resolve()));
    assert.equal(dirname(root), cacheRoot, 'only this test fixture may be removed recursively');
    await rm(root, { recursive: true, force: true });
  }
});
