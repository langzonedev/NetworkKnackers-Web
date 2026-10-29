import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
function worker() {
  const listeners = {}, removed = [], shell = [];
  const cached = { cached: true };
  const context = { URL, Promise, self: { location: { origin: 'https://example.test' }, registration: { scope: 'https://example.test/NetworkKnackers-Web/' }, addEventListener: (type, handler) => { listeners[type] = handler; }, clients: { claim: async () => {} } }, caches: { open: async () => ({ addAll: async urls => shell.push(...urls), match: async () => cached }), keys: async () => ['unrelated-app', 'network-knackers-v0.1.0', 'network-knackers-v0.3.0'], delete: async key => { removed.push(key); } }, fetch: async () => { throw new Error('Unexpected network request'); } };
  vm.runInNewContext(source, context); return { listeners, removed, shell, cached };
}
test('worker precaches local tool module and raster install icons', async () => {
  const { listeners, shell } = worker(); let pending; listeners.install({ waitUntil: p => { pending = p; } }); await pending;
  assert.ok(shell.includes('./tools.js?v=0.3.0')); assert.ok(shell.includes('./icons/icon-512.png?v=0.3.0'));
});
test('worker activation preserves unrelated origin caches', async () => {
  const { listeners, removed } = worker(); let pending; listeners.activate({ waitUntil: p => { pending = p; } }); await pending;
  assert.deepEqual(removed, ['network-knackers-v0.1.0']);
});
test('external calls and unknown same-origin assets bypass service worker', () => {
  const { listeners } = worker();
  for (const url of ['https://api.ipify.org?format=json', 'https://cloudflare-dns.com/dns-query?name=example.com', 'https://example.test/another-app/api']) listeners.fetch({ request: { url, method: 'GET' }, respondWith: () => assert.fail('should bypass') });
});
test('offline navigation and shell module return cached assets', async () => {
  const { listeners, cached } = worker();
  for (const [path, mode] of [['', 'navigate'], ['tools.js?v=0.3.0', 'cors']]) {
    let response; listeners.fetch({ request: { url: `https://example.test/NetworkKnackers-Web/${path}`, method: 'GET', mode }, respondWith: p => { response = p; } });
    assert.equal(await response, cached);
  }
});
