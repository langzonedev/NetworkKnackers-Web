import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSubnet, parseIPv4, normalizeDNSName, resolveDNS, lookupPublicIP, fetchJSON, isIPv6 } from '../tools.js';
const get = (r, label) => r.fields.find(f => f.label === label).value;
const mock = data => async () => ({ ok: true, json: async () => data });
test('subnet known answers include unsigned boundaries, /0, /31 and /32', () => {
  const r = calculateSubnet('192.168.1.100/24');
  assert.equal(get(r, 'Network'), '192.168.1.0/24');
  assert.equal(get(r, 'Broadcast'), '192.168.1.255');
  assert.equal(get(r, 'Host range'), '192.168.1.1 – 192.168.1.254');
  assert.equal(get(r, 'Subnet mask'), '255.255.255.0');
  assert.equal(get(calculateSubnet('255.255.255.255/0'), 'Network'), '0.0.0.0/0');
  assert.equal(get(calculateSubnet('0.0.0.0/0'), 'Broadcast'), '255.255.255.255');
  assert.equal(get(calculateSubnet('10.0.0.1/31'), 'Host range'), '10.0.0.0 – 10.0.0.1');
  assert.equal(get(calculateSubnet('10.0.0.1/31'), 'Broadcast'), 'Not applicable');
  assert.equal(get(calculateSubnet('255.255.255.255/32'), 'Host range'), '255.255.255.255 – 255.255.255.255');
  assert.equal(get(calculateSubnet('10.0.0.1/32'), 'Usable addresses'), '1');
});
test('subnet mask/network containment invariants across all prefixes', () => {
  for (let prefix = 0; prefix <= 32; prefix++) {
    const r = calculateSubnet(`203.0.113.27/${prefix}`);
    const net = parseIPv4(get(r, 'Network').split('/')[0]); const size = 2 ** (32 - prefix);
    assert.equal(net % size, 0); assert.ok(parseIPv4('203.0.113.27') >= net && parseIPv4('203.0.113.27') < net + size);
    assert.equal(parseIPv4(get(r, 'Subnet mask')) + parseIPv4(get(r, 'Wildcard mask')), 2 ** 32 - 1);
  }
});
test('malformed CIDR and ambiguous octets rejected', () => {
  for (const value of ['', '10.0.0.1', '10.0.0.1/-1', '10.0.0.1/33', '10.0.0.1/1.5', '10.0.0.1/24/1', '256.0.0.1/24', '010.0.0.1/24', '::1/64', '1.2.3/24']) assert.throws(() => calculateSubnet(value), Error, value);
});
test('DNS normalization accepts service names; rejects URLs, injection and oversized labels', () => {
  assert.equal(normalizeDNSName(' Example.COM. '), 'example.com');
  assert.equal(normalizeDNSName('_sip._tcp.example.com'), '_sip._tcp.example.com');
  for (const name of ['https://example.com', 'foo/bar', 'a&name=other.com', '<script>', '-bad.com', 'bad..com', `${'a'.repeat(64)}.com`]) assert.throws(() => normalizeDNSName(name));
});
test('DNS transport encodes input and discloses resolver, TTL and raw data', async () => {
  let options, target;
  const data = { Status: 0, Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] };
  const r = await resolveDNS({ name: 'example.com', type: 'A' }, { fetchFn: async (url, opts) => { target = url; options = opts; return { ok: true, json: async () => data }; } });
  assert.equal(new URL(target).searchParams.get('type'), 'A'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.headers.accept, 'application/dns-json');
  assert.match(r.fields[1].detail, /TTL 300/); assert.deepEqual(r.raw, data);
});
test('DNS NXDOMAIN and NODATA are distinct from transport and resolver errors', async () => {
  const query = { name: 'example.com', type: 'TXT' };
  assert.match((await resolveDNS(query, { fetchFn: mock({ Status: 3 }) })).summary, /does not exist/);
  assert.match((await resolveDNS(query, { fetchFn: mock({ Status: 0 }) })).summary, /no TXT answer/);
  assert.equal((await resolveDNS(query, { fetchFn: mock({ Status: 2 }) })).status, 'error');
  for (const data of [{}, { Status: 0, Answer: 'oops' }, { Status: 0, Answer: [{}] }]) await assert.rejects(resolveDNS(query, { fetchFn: mock(data) }), /invalid/);
  await assert.rejects(resolveDNS({ ...query, type: 'ANY' }), /supported/);
});
test('public IP separates family endpoints and validates provider output', async () => {
  const r = await lookupPublicIP({}, { fetchFn: mock({ ip: '203.0.113.5' }) }); assert.equal(get(r, 'Public IPv4'), '203.0.113.5');
  let endpoint;
  await lookupPublicIP({ family: '6' }, { fetchFn: async url => { endpoint = url; return { ok: true, json: async () => ({ ip: '2001:db8::1' }) }; } });
  assert.match(endpoint, /api6/);
  for (const ip of ['garbage', '999.1.1.1', '2001:db8::1']) await assert.rejects(lookupPublicIP({}, { fetchFn: mock({ ip }) }), /invalid/);
  assert.equal(isIPv6('::::'), false); assert.equal(isIPv6('::1'), true); assert.equal(isIPv6('1:2:3:4:5:6:7:8'), true);
});
test('HTTP errors, network failure, timeout and abort settle with actionable messages', async () => {
  await assert.rejects(fetchJSON('https://test.invalid', { fetchFn: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
  await assert.rejects(fetchJSON('https://test.invalid', { fetchFn: async () => { throw new TypeError('Failed to fetch'); } }), /connection/);
  const waitForAbort = async (_, { signal }) => new Promise((resolve, reject) => { if (signal.aborted) reject(new Error('aborted')); else signal.addEventListener('abort', () => reject(new Error('aborted'))); });
  await assert.rejects(fetchJSON('https://test.invalid', { fetchFn: waitForAbort, timeoutMs: 5 }), /within/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchJSON('https://test.invalid', { fetchFn: waitForAbort, signal: controller.signal }), /cancelled/);
});
