import { DNS_TYPES, DNS_RESOLVERS, expandIPv6, parseIPv4, normalizeDNSName, resolveDNS } from './tools.js?v=0.3.0';
const field = (label, value, detail = '', kind = 'derived') => ({ label, value: String(value), detail, kind });
const result = (title, summary, fields, note, raw) => ({ status: 'success', title, summary, fields, note, raw, checkedAt: new Date().toISOString() });
const LOCAL = 'Processed on your device. Nothing is sent to a server. Inputs and results stay in this session until you reload, unless you copy them.';
const boundedText = value => { if (typeof value !== 'string' || value.length > 100000) throw new Error('Use up to 100,000 characters per operation.'); return value; };

export function reverseName(input) {
  const value = String(input).trim();
  if (value.includes(':')) return `${expandIPv6(value).join('').split('').reverse().join('.')}.ip6.arpa`;
  parseIPv4(value);
  return `${value.split('.').reverse().join('.')}.in-addr.arpa`;
}
export async function reverseDNS({ address }, context = {}) {
  const name = reverseName(address);
  const response = await resolveDNS({ name, type: 'PTR' }, context);
  return { ...response, title: 'Reverse DNS', summary: `${address.trim()}: ${response.summary}`, fields: [field('Reverse query', name, 'Derived from the supplied IP.'), ...response.fields], note: `${response.note} PTR names are operator-controlled labels; they do not establish device identity or ownership.` };
}
const normalizeAnswer = answer => {
  let data = answer.data.trim();
  if ([2, 5, 12].includes(answer.type)) data = data.toLowerCase().replace(/\.$/, '');
  if ([15, 33].includes(answer.type)) data = data.replace(/\s+/g, ' ').replace(/\S+$/, s => s.toLowerCase().replace(/\.$/, ''));
  if (answer.type === 28) { try { data = expandIPv6(data).join(':'); } catch { /* Retain unexpected resolver text. */ } }
  return JSON.stringify([answer.name.toLowerCase().replace(/\.$/, ''), answer.type, data]);
};
export async function compareDNS(input, context = {}) {
  input = { ...input, name: normalizeDNSName(input.name) };
  if (!Object.hasOwn(DNS_TYPES, input.type || 'A')) throw new Error('Choose a supported DNS record type.');
  const providers = Object.keys(DNS_RESOLVERS);
  const outcomes = await Promise.allSettled(providers.map(resolver => resolveDNS({ ...input, resolver }, context)));
  if (context.signal?.aborted) throw new Error('Check cancelled.');
  const fields = [], raw = {};
  let complete = true;
  for (let i = 0; i < outcomes.length; i++) {
    const entry = outcomes[i], provider = DNS_RESOLVERS[providers[i]].title;
    if (entry.status === 'rejected') { complete = false; fields.push(field(provider, 'Unavailable', entry.reason.message, 'unavailable')); continue; }
    const r = entry.value; raw[provider] = r.raw;
    if (r.status !== 'success') complete = false;
    fields.push(field(`${provider} response`, r.fields[0].value, r.summary, 'observed'));
    fields.push(...r.fields.slice(1).map(f => ({ ...f, label: `${provider} · ${f.label}` })));
  }
  let summary = 'Comparison incomplete. One or more resolvers failed; inspect the available response below.';
  if (complete) {
    const [a, b] = outcomes.map(o => o.value.raw);
    const signature = d => JSON.stringify([d.Status, [...new Set((d.Answer || []).map(normalizeAnswer))].sort()]);
    const same = signature(a) === signature(b);
    summary = same ? 'The two resolver responses match (ignoring TTL and record order).' : 'The resolver responses differ. This can reflect cache timing, routing or DNS policy.';
    if (!(a.Answer || []).length && !(b.Answer || []).length) summary += ' Neither returned answer records.';
  }
  return { ...result('DNS Resolver Comparison', summary, fields, 'Cloudflare and Google each receive your query and public IP. Google ECS is disabled for this query. Two recursive-resolver snapshots are not proof of global propagation, authoritative consistency or DNS health.', raw), status: complete ? 'success' : 'error' };
}

const ipv6Number = words => BigInt(`0x${words.join('')}`);
export function compressIPv6(words) {
  const parts = words.map(w => parseInt(w, 16).toString(16));
  let bestStart = -1, bestSize = 1;
  for (let i = 0; i < parts.length;) { if (parts[i] !== '0') { i++; continue; } let end = i; while (parts[end] === '0') end++; if (end - i > bestSize) { bestStart = i; bestSize = end - i; } i = end; }
  return bestStart < 0 ? parts.join(':') : `${parts.slice(0, bestStart).join(':')}::${parts.slice(bestStart + bestSize).join(':')}`;
}
const wordsFromBigInt = value => value.toString(16).padStart(32, '0').match(/.{4}/g);
export function ipv6Prefix({ cidr }) {
  const parts = String(cidr).trim().split('/');
  if (parts.length !== 2 || !/^(0|[1-9]\d{0,2})$/.test(parts[1]) || Number(parts[1]) > 128) throw new Error('Use IPv6/prefix, for example 2001:db8:1234::1/64. Prefix must be 0–128.');
  const words = expandIPv6(parts[0]), prefix = Number(parts[1]), bits = 128n - BigInt(prefix);
  const count = 1n << bits, network = (ipv6Number(words) >> bits) << bits, last = network + count - 1n;
  return result('IPv6 Prefix', `${compressIPv6(wordsFromBigInt(network))}/${prefix}`, [field('Prefix', `${compressIPv6(wordsFromBigInt(network))}/${prefix}`), field('First address', compressIPv6(wordsFromBigInt(network))), field('Last address', compressIPv6(wordsFromBigInt(last))), field('Address count', count.toString(), 'Total addresses, not a usable-host count. IPv6 has no broadcast; address roles and subnet-router anycast are not subtracted.'), field('Expanded input', words.join(':'), 'User-supplied address; not an observed interface.', 'user-supplied')], `${LOCAL} This is address arithmetic, not a recommendation for SLAAC or subnet design.`);
}

// Curated common-use reference, not an exhaustive IANA registry or traffic detector.
export const PORTS = [
  [20,'TCP','FTP data'], [21,'TCP','FTP control'], [22,'TCP','SSH / SFTP'], [23,'TCP','Telnet'], [25,'TCP','SMTP'], [53,'TCP/UDP','DNS'], [67,'UDP','DHCP server'], [68,'UDP','DHCP client'], [69,'UDP','TFTP'], [80,'TCP','HTTP'], [88,'TCP/UDP','Kerberos'], [110,'TCP','POP3'], [123,'UDP','NTP'], [135,'TCP','Microsoft RPC endpoint mapper'], [137,'UDP','NetBIOS name service'], [138,'UDP','NetBIOS datagram'], [139,'TCP','NetBIOS session'], [143,'TCP','IMAP'], [161,'UDP','SNMP'], [162,'UDP','SNMP traps'], [389,'TCP/UDP','LDAP'], [443,'TCP/UDP','HTTPS (TCP) / HTTP/3 over QUIC (UDP)'], [445,'TCP','SMB'], [465,'TCP','Message submission over TLS'], [500,'UDP','IKE / IPsec'], [514,'UDP','Syslog'], [587,'TCP','SMTP submission'], [636,'TCP','LDAP over TLS'], [853,'TCP','DNS over TLS'], [993,'TCP','IMAP over TLS'], [995,'TCP','POP3 over TLS'], [1433,'TCP','Microsoft SQL Server'], [1521,'TCP','Oracle listener (typical)'], [2049,'TCP/UDP','NFS'], [3306,'TCP','MySQL'], [3389,'TCP/UDP','Remote Desktop / RDP'], [4500,'UDP','IPsec NAT traversal'], [5432,'TCP','PostgreSQL'], [5900,'TCP','VNC / RFB'], [5985,'TCP','WinRM HTTP'], [5986,'TCP','WinRM HTTPS'], [8080,'TCP','HTTP alternate (common)']
];
export function portReference({ query, protocol = 'Any' }) {
  const search = String(query).trim().toLowerCase();
  if (!search) throw new Error('Enter a port number or service name, such as 443, DNS or SMB.');
  if (!['Any','TCP','UDP'].includes(protocol)) throw new Error('Choose TCP, UDP or Any.');
  if (/^[-+]?\d/.test(search) && (!/^\d+$/.test(search) || Number(search) > 65535)) throw new Error('Port numbers must be integers from 0 to 65535.');
  const matches = PORTS.filter(([port, transport, service]) => (protocol === 'Any' || transport.includes(protocol)) && (/^\d+$/.test(search) ? port === Number(search) : service.toLowerCase().includes(search)));
  return result('Port / Service Reference', matches.length ? `${matches.length} common service match${matches.length === 1 ? '' : 'es'}.` : 'No match in this curated reference. That does not mean the port is unassigned or unused.', matches.map(([port, transport, service]) => field(`${port} / ${transport}`, service, 'Common use; no connectivity check performed.', 'reference')), `${LOCAL} A port number does not prove which service is listening, or whether it is safe. Reference: IANA service-name/port registry and Microsoft service port documentation; common-use subset reviewed 2026-10-29.`);
}
export function inspectURL({ url }) {
  boundedText(url);
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Enter a complete URL, including https:// or http://.'); }
  if (!['http:','https:'].includes(parsed.protocol)) throw new Error('This inspector supports HTTP and HTTPS URLs.');
  if (parsed.username || parsed.password) throw new Error('Remove embedded usernames and passwords before inspecting this URL.');
  const fields = [field('Scheme', parsed.protocol.replace(':','')), field('Hostname', parsed.hostname), field('Port', parsed.port || (parsed.protocol === 'https:' ? '443 (default)' : '80 (default)')), field('Path', parsed.pathname), field('Fragment', parsed.hash || '(none)', 'Not sent in an HTTP request.')];
  for (const [key, value] of parsed.searchParams) fields.push(field(`Query · ${key}`, value, 'URL-decoded parameter. Repeated keys remain separate.'));
  return result('URL Inspector', `Parsed ${parsed.hostname} locally. No request was made.`, fields, `${LOCAL} Parsing a URL does not check its reachability, certificate or trustworthiness. Query strings can contain secrets; copy results deliberately.`);
}
export function formatJSON({ text, format = 'Pretty' }) {
  boundedText(text);
  if (!['Pretty','Minified'].includes(format)) throw new Error('Choose Pretty or Minified.');
  try { JSON.parse(text); } catch { throw new Error('Invalid JSON. Check quotes, commas and brackets; input is kept for correction.'); }
  // Reformat validated lexical tokens, not parsed JS values: retain large numbers and duplicate keys.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g);
  let output = '', depth = 0;
  const pretty = format === 'Pretty';
  const newline = () => pretty ? `\n${'  '.repeat(depth)}` : '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{' || token === '[') { output += token; depth++; if (depth > 64) throw new Error('Use JSON nested no deeper than 64 levels.'); if (!['}',']'].includes(tokens[i + 1])) output += newline(); }
    else if (token === '}' || token === ']') { depth--; if (!['{','['].includes(tokens[i - 1])) output += newline(); output += token; }
    else if (token === ',') output += `,${newline()}`;
    else if (token === ':') output += pretty ? ': ' : ':';
    else output += token;
    if (output.length > 300000) throw new Error('Formatted output is too large. Use Minified output or a smaller document.');
  }
  return result('JSON Formatter', 'Valid JSON. Formatted locally.', [field('Formatted JSON', output, 'Number spelling, string escapes and duplicate keys are preserved.')], `${LOCAL} Whitespace outside strings is reformatted; data tokens are retained.`);
}
export function convertBase64({ text, mode = 'Encode' }) {
  boundedText(text);
  let output;
  if (mode === 'Encode') { const bytes = new TextEncoder().encode(text); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); output = btoa(binary); }
  else if (mode === 'Decode') {
    const compact = text.replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) throw new Error('Enter standard padded Base64. URL-safe Base64 is not supported by this tool.');
    try { const binary = atob(compact); if (btoa(binary) !== compact) throw new Error('Noncanonical encoding'); output = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))); } catch { throw new Error('This is not canonical Base64 containing valid UTF-8 text. Binary files are not supported.'); }
  } else throw new Error('Choose Encode or Decode.');
  return result('Base64 Text', `${mode === 'Encode' ? 'Encoded UTF-8 text' : 'Decoded UTF-8 text'}.`, [field('Output', output, 'Standard Base64; not encryption.')], LOCAL);
}
export async function hashText({ text, algorithm = 'SHA-256' }, { cryptoAPI = globalThis.crypto } = {}) {
  boundedText(text);
  if (!['SHA-256','SHA-384','SHA-512'].includes(algorithm)) throw new Error('Choose a supported SHA algorithm.');
  if (!cryptoAPI?.subtle) throw new Error('Web Crypto is unavailable. Open the HTTPS version of this app.');
  const bytes = new TextEncoder().encode(text);
  const digest = await cryptoAPI.subtle.digest(algorithm, bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  return result('Text Hash', `${algorithm} digest of ${bytes.length} UTF-8 bytes.`, [field('Hex digest', hex), field('Input size', `${bytes.length} bytes`, 'Includes spaces and newlines exactly as entered.')], `${LOCAL} A bare hash is not password storage or proof of authenticity.`);
}
const input = (name, label, placeholder, value = '') => ({ name, label, placeholder, value });
const select = (name, label, options) => ({ name, label, options });
const textInput = () => ({ name: 'text', label: 'Input text', multiline: true, required: false, placeholder: 'Paste text here…' });
const localTool = (id, title, category, description, inputs, run, action) => ({ id, title, category, description, inputs, run: ({ input, ...context }) => Promise.resolve(run(input, context)), action, availability: 'available', activity: 'passive', requirements: ['browser'], disclosure: LOCAL });
const dnsInputs = () => [input('name','DNS name','example.com'), select('type','Record type',Object.keys(DNS_TYPES))];
export const extraTools = [
  { id: 'dns.reverse', title: 'Reverse DNS', category: 'Investigate', description: 'Look up the PTR name behind an IPv4 or IPv6 address.', inputs: [input('address','IP address','1.1.1.1')], run: ({ input, ...context }) => reverseDNS(input, context), availability: 'available', activity: 'active', requirements: ['internet','cloudflare-doh'], disclosure: 'Sends the IP-derived reverse query and your public IP to Cloudflare. A PTR name is not verified device identity.' },
  { id: 'dns.compare', title: 'DNS Resolver Comparison', category: 'Test Something', description: 'Compare the answers from Cloudflare and Google.', inputs: dnsInputs(), run: ({ input, ...context }) => compareDNS(input, context), availability: 'available', activity: 'active', requirements: ['internet','cloudflare-doh','google-doh'], disclosure: 'Sends two HTTPS queries: Cloudflare and Google both see the name and your public IP. This compares recursive resolvers, not global propagation.' },
  localTool('ipv6.prefix','IPv6 Prefix','Calculate','Expand IPv6 and calculate its prefix range.',[input('cidr','IPv6 address / prefix','2001:db8:1234::1/64','2001:db8:1234::1/64')],ipv6Prefix,'Calculate prefix'),
  localTool('port.reference','Port / Service Reference','Investigate','Find common TCP/UDP ports by number or service.',[input('query','Port or service','443, DNS, SMB…'),select('protocol','Transport',['Any','TCP','UDP'])],portReference,'Find service'),
  localTool('url.inspect','URL Inspector','Investigate','Break down a URL without opening its destination.',[input('url','HTTP / HTTPS URL','https://example.com/path?key=value')],inspectURL,'Inspect URL'),
  localTool('json.format','JSON Formatter','Sysadmin','Validate and format JSON without uploading it.',[textInput(),select('format','Output format',['Pretty','Minified'])],formatJSON,'Format JSON'),
  localTool('base64.convert','Base64 Text','Sysadmin','Encode or decode UTF-8 text locally.',[textInput(),select('mode','Operation',['Encode','Decode'])],convertBase64,'Convert text'),
  localTool('hash.text','Text Hash','Sysadmin','Generate a SHA-256, SHA-384 or SHA-512 digest.',[textInput(),select('algorithm','Algorithm',['SHA-256','SHA-384','SHA-512'])],hashText,'Hash text')
];
