// Generic public adapters only. No native networking or stored observations.
export const DNS_TYPES = Object.freeze({ A: 1, AAAA: 28, CNAME: 5, MX: 15, TXT: 16, NS: 2, SOA: 6, SRV: 33, PTR: 12 });
const field = (label, value, detail = '', kind = 'observed') => ({ label, value: String(value), detail, kind });
const result = (title, summary, fields, note, raw) => ({ status: 'success', title, summary, fields, note, raw, checkedAt: new Date().toISOString() });

export function parseIPv4(value) {
  if (!/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value)) throw new Error('Enter an IPv4 address, for example 192.168.1.10.');
  const bytes = value.split('.').map(Number);
  if (bytes.some(n => n > 255)) throw new Error('Each IPv4 octet must be between 0 and 255.');
  return bytes.reduce((n, byte) => n * 256 + byte, 0);
}
const ipv4 = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
export function calculateSubnet(input) {
  const parts = String(input).trim().split('/');
  if (parts.length !== 2 || !/^(0|[1-9]\d?)$/.test(parts[1]) || Number(parts[1]) > 32) throw new Error('Use IPv4/prefix, for example 192.168.1.10/24. Prefix must be 0–32.');
  const address = parseIPv4(parts[0]);
  const prefix = Number(parts[1]);
  const total = 2 ** (32 - prefix);
  const network = Math.floor(address / total) * total;
  const last = network + total - 1;
  const usable = prefix >= 31 ? total : total - 2;
  const note = prefix === 31 ? 'A /31 provides two point-to-point endpoint addresses (RFC 3021), without a directed broadcast.' : prefix === 32 ? 'A /32 identifies one host route, without a directed broadcast.' : 'Conventional host range excludes the network and directed broadcast addresses. Routing and device configuration determine reachability.';
  return result('Subnet / CIDR', `${ipv4(network)}/${prefix} contains ${total.toLocaleString('en-US')} addresses.`, [
    field('Network', `${ipv4(network)}/${prefix}`, 'Calculated from your input.', 'derived'),
    field('Subnet mask', ipv4(2 ** 32 - total), '', 'derived'),
    field('Wildcard mask', ipv4(total - 1), '', 'derived'),
    field('Broadcast', prefix >= 31 ? 'Not applicable' : ipv4(last), '', 'derived'),
    field('Host range', `${ipv4(prefix >= 31 ? network : network + 1)} – ${ipv4(prefix >= 31 ? last : last - 1)}`, '', 'derived'),
    field('Usable addresses', usable.toLocaleString('en-US'), prefix === 31 ? 'Point-to-point endpoints.' : '', 'derived'),
    field('Input address', parts[0], 'User supplied; not an observed interface address.', 'user-supplied')
  ], `Local calculation. Nothing sent over the network. ${note}`);
}

export function normalizeDNSName(input) {
  const value = String(input).trim().replace(/\.$/, '');
  if (!value || value.length > 253 || !value.split('.').every(label => label.length <= 63 && /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label))) throw new Error('Enter a DNS name, such as example.com or _sip._tcp.example.com. Use punycode for international names; omit https:// and paths.');
  return value.toLowerCase();
}

export async function fetchJSON(url, { fetchFn = globalThis.fetch, signal, headers = {}, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal, headers, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`The provider returned HTTP ${response.status}. Try again later.`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Check cancelled.' : 'The provider did not respond within 8 seconds. Try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the provider. Check your connection; browser or network restrictions may block this request.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function lookupPublicIP({ family = '4' } = {}, context = {}) {
  if (!['4', '6'].includes(family)) throw new Error('Choose IPv4 or IPv6.');
  const endpoint = family === '6' ? 'api6.ipify.org' : 'api.ipify.org';
  const data = await fetchJSON(`https://${endpoint}?format=json`, context);
  if (!data || typeof data.ip !== 'string' || (family === '6' ? !isIPv6(data.ip) : !validIPv4(data.ip))) throw new Error('The provider returned an invalid IP address.');
  return result('Public IP', `Your public IPv${family} address as seen by ipify.`, [field(`Public IPv${family}`, data.ip, `Observed by ${endpoint}. This may be a VPN, proxy or shared NAT exit address.`)], 'One HTTPS request to ipify. An IPv6 failure does not prove your network lacks IPv6. This is not your local device address.', data);
}
function validIPv4(value) { try { parseIPv4(value); return true; } catch { return false; } }
export function expandIPv6(input) {
  let value = String(input).toLowerCase();
  if (value.includes('.')) {
    const split = value.lastIndexOf(':');
    if (split < 0) throw new Error('Enter an IPv6 address.');
    const v4 = parseIPv4(value.slice(split + 1));
    value = `${value.slice(0, split + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/.test(value) || !value.includes(':')) throw new Error('Enter an IPv6 address without a zone ID or brackets.');
  const halves = value.split('::');
  const groups = halves.flatMap(h => h ? h.split(':') : []);
  if (halves.length > 2 || !groups.every(g => /^[0-9a-f]{1,4}$/.test(g)) || (halves.length === 2 ? groups.length >= 8 : groups.length !== 8)) throw new Error('Enter a valid IPv6 address.');
  const words = halves.length === 2 ? [...(halves[0] ? halves[0].split(':') : []), ...Array(8 - groups.length).fill('0'), ...(halves[1] ? halves[1].split(':') : [])] : groups;
  return words.map(word => word.padStart(4, '0'));
}
export function isIPv6(value) { try { expandIPv6(value); return true; } catch { return false; } }
export const DNS_RESOLVERS = Object.freeze({ cloudflare: { title: 'Cloudflare', endpoint: 'https://cloudflare-dns.com/dns-query' }, google: { title: 'Google', endpoint: 'https://dns.google/resolve' } });
export async function resolveDNS({ name, type = 'A', resolver = 'cloudflare' }, context = {}) {
  name = normalizeDNSName(name);
  if (!Object.hasOwn(DNS_TYPES, type)) throw new Error('Choose a supported DNS record type.');
  if (!Object.hasOwn(DNS_RESOLVERS, resolver)) throw new Error('Choose a supported resolver.');
  const provider = DNS_RESOLVERS[resolver];
  const url = new URL(provider.endpoint);
  url.search = new URLSearchParams({ name, type });
  if (resolver === 'google') url.searchParams.set('edns_client_subnet', '0.0.0.0/0');
  const data = await fetchJSON(url.href, { ...context, headers: { accept: 'application/dns-json' } });
  if (!data || !Number.isInteger(data.Status) || data.Status < 0 || data.Status > 15 || (data.Answer !== undefined && (!Array.isArray(data.Answer) || data.Answer.some(a => !a || typeof a.name !== 'string' || typeof a.data !== 'string' || !Number.isInteger(a.type) || !Number.isFinite(a.TTL) || a.TTL < 0)))) throw new Error('The resolver returned an invalid DNS response.');
  const rcode = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' }[data.Status] || `RCODE ${data.Status}`;
  const answers = data.Answer || [];
  const summary = data.Status === 0 ? answers.length ? `${name} returned ${answers.length} answer record${answers.length === 1 ? '' : 's'}.` : `${name}: no ${type} answer records returned.` : data.Status === 3 ? `${name}: the resolver reports that this name does not exist (NXDOMAIN).` : `${name}: the resolver returned ${rcode}.`;
  const fields = [field('DNS response', rcode, `Observed via ${provider.title} DNS-over-HTTPS.`)];
  for (const answer of answers) fields.push(field(`${Object.keys(DNS_TYPES).find(k => DNS_TYPES[k] === answer.type) || `TYPE${answer.type}`} · ${answer.name}`, answer.data, `TTL ${answer.TTL} seconds · ${provider.title} recursive resolver`));
  const output = result('DNS Lookup', summary, fields, `${provider.title} receives the query name and your public IP. This does not test your OS-configured resolver or prove global propagation. TTLs reflect this resolver’s cache.`, data);
  if (data.Status !== 0 && data.Status !== 3) output.status = 'error';
  return output;
}

export const webTools = [
  { id: 'public_ip.lookup', title: 'Public IP', category: 'My Network', description: 'Find the address the internet sees.', availability: 'available', activity: 'active', requirements: ['internet', 'ipify'], disclosure: 'Sends one HTTPS request to ipify, which sees your public IP. Choose IPv4 or IPv6; no automatic fallback.', inputs: [{ name: 'family', label: 'Address family', options: ['4', '6'], labels: ['IPv4', 'IPv6'] }], run: ({ input, ...context }) => lookupPublicIP(input, context) },
  { id: 'dns.resolve', title: 'DNS Lookup', category: 'Test Something', description: 'Inspect the records behind a DNS name.', availability: 'available', activity: 'active', requirements: ['internet', 'cloudflare-doh'], disclosure: 'Sends your query name and public IP to Cloudflare DNS-over-HTTPS. It does not use your system DNS resolver.', inputs: [{ name: 'name', label: 'DNS name', placeholder: 'example.com', value: '' }, { name: 'type', label: 'Record type', options: Object.keys(DNS_TYPES) }], run: ({ input, ...context }) => resolveDNS(input, context) },
  { id: 'subnet.calculate', title: 'Subnet / CIDR', category: 'Calculate', description: 'Turn an IPv4 prefix into a usable address plan.', availability: 'available', activity: 'passive', requirements: ['browser'], disclosure: 'Calculated entirely on your device. Works offline after the app has been cached.', inputs: [{ name: 'cidr', label: 'IPv4 address / prefix', placeholder: '192.168.1.10/24', value: '192.168.1.10/24' }], run: ({ input }) => Promise.resolve(calculateSubnet(input.cidr)) }
];
