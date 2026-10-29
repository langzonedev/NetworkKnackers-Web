import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { expandIPv6, isIPv6 } from '../tools.js';
import { reverseName, reverseDNS, compareDNS, ipv6Prefix, compressIPv6, portReference, inspectURL, formatJSON, convertBase64, hashText } from '../extra-tools.js';
const value = (r, label) => r.fields.find(f => f.label === label).value;
const response = data => ({ ok: true, json: async () => data });
const answer = (data, type = 1, TTL = 300, name = 'example.com.') => ({ name, type, TTL, data });
test('IPv6 expands compressed, full and mapped addresses; rejects malformed forms', () => {
  assert.equal(expandIPv6('::').join(''), '0'.repeat(32));
  assert.equal(expandIPv6('::ffff:192.0.2.128').join(':'), '0000:0000:0000:0000:0000:ffff:c000:0280');
  assert.equal(compressIPv6(expandIPv6('2001:0:0:1:0:0:1:1')), '2001::1:0:0:1:1');
  for (const bad of ['1:2:3:4:5:6:7:', ':1:2:3:4:5:6:7', '1::2::3', '1:2:3:4:5:6:7:8::', '::ffff:300.0.0.1', '::ffff:01.2.3.4', '[::1]', 'fe80::1%eth0', 'abc', ':::']) assert.equal(isIPv6(bad), false, bad);
});
test('IPv6 prefix exact range, /0 and /128; all prefix masks obey containment', () => {
  const r = ipv6Prefix({cidr:'2001:db8:abcd:1::123/64'});
  assert.equal(value(r,'Prefix'),'2001:db8:abcd:1::/64');
  assert.equal(value(r,'Last address'),'2001:db8:abcd:1:ffff:ffff:ffff:ffff');
  assert.equal(value(r,'Address count'),'18446744073709551616');
  assert.equal(value(ipv6Prefix({cidr:'::1/0'}),'Address count'), (1n << 128n).toString());
  assert.equal(value(ipv6Prefix({cidr:'::1/128'}),'First address'),'::1');
  for (let p=0; p<=128; p++) {
    const r = ipv6Prefix({cidr:`2001:db8::abcd/${p}`});
    const n = BigInt('0x'+expandIPv6(value(r,'First address')).join(''));
    const end = BigInt('0x'+expandIPv6(value(r,'Last address')).join(''));
    assert.equal(end-n+1n,1n<<BigInt(128-p)); assert.equal(n % (1n<<BigInt(128-p)),0n);
  }
  for(const cidr of ['::1/129','::1/-1','::1/01','::1/2/3','1.2.3.4/24']) assert.throws(()=>ipv6Prefix({cidr}));
});
test('reverse DNS generates IPv4 octets and all 32 reversed IPv6 nibbles', async () => {
  assert.equal(reverseName(' 192.0.2.15 '), '15.2.0.192.in-addr.arpa');
  assert.equal(reverseName('::1'), `1.${Array(31).fill('0').join('.')}.ip6.arpa`);
  let target;
  const r=await reverseDNS({address:'1.1.1.1'}, {fetchFn: async url=>{target=new URL(url);return response({Status:0,Answer:[answer('one.one.one.one.',12)]})}});
  assert.equal(target.searchParams.get('name'),'1.1.1.1.in-addr.arpa');assert.equal(target.searchParams.get('type'),'PTR');assert.equal(r.title,'Reverse DNS');assert.match(r.note,/do not establish/);
  for(const bad of ['1.2.3.999','example.com','::x','10.0.0.1/24']) assert.throws(()=>reverseName(bad));
});
test('DNS comparison ignores TTL/order and canonical domain/IPv6 representation',async()=>{
  const r=await compareDNS({name:'example.com',type:'AAAA'},{fetchFn:async url=>{
    const google=new URL(url).hostname==='dns.google';
    if(google) assert.equal(new URL(url).searchParams.get('edns_client_subnet'),'0.0.0.0/0');
    return response({Status:0,Answer:google?[answer('2001:0db8:0:0:0:0:0:1',28,10),answer('target.example.',5,1)]:[answer('TARGET.EXAMPLE.',5,100),answer('2001:db8::1',28,300)]});
  }});
  assert.match(r.summary,/responses match/);assert.equal(r.status,'success');assert.ok(r.raw.Google);
});
test('DNS comparison distinguishes NXDOMAIN, empty answer and differing addresses',async()=>{
  for(const [a,b] of [[{Status:3},{Status:0}],[{Status:0,Answer:[answer('192.0.2.1')]},{Status:0,Answer:[answer('192.0.2.2')]}]]){
    let i=0;const r=await compareDNS({name:'example.com',type:'A'},{fetchFn:async()=>response([a,b][i++])});assert.match(r.summary,/responses differ/);
  }
  const r=await compareDNS({name:'example.com',type:'A'},{fetchFn:async()=>response({Status:0})});assert.match(r.summary,/Neither returned/);
});
test('DNS comparison preserves one resolver response on failure and rejects input before requests',async()=>{
  let calls=0;const r=await compareDNS({name:'example.com',type:'A'},{fetchFn:async url=>{if(url.includes('dns.google')) throw new TypeError('network');return response({Status:0,Answer:[answer('192.0.2.1')]})}});
  assert.equal(r.status,'error');assert.ok(r.fields.some(f=>f.value==='192.0.2.1'));assert.ok(r.fields.some(f=>f.kind==='unavailable'));
  await assert.rejects(compareDNS({name:'https://example.com',type:'A'},{fetchFn:async()=>{calls++}}));assert.equal(calls,0);
  await assert.rejects(compareDNS({name:'example.com',type:'ANY'}));
});
test('port reference filters transport and treats missing ports as unknown, not closed',()=>{
  assert.match(value(portReference({query:'443',protocol:'UDP'}),'443 / TCP/UDP'),/QUIC/);
  assert.match(value(portReference({query:'SMB'}),'445 / TCP'),/SMB/);
  assert.equal(portReference({query:'22',protocol:'UDP'}).fields.length,0);
  assert.match(portReference({query:'65535'}).summary,/does not mean/);
  for(const query of ['-1','65536','22.5','']) assert.throws(()=>portReference({query}));
});
test('URL inspector preserves repeated query params, default ports and avoids embedded credentials',()=>{
  const r=inspectURL({url:'https://example.com/path?a=one+two&a=%26#part'});
  assert.equal(value(r,'Port'),'443 (default)');assert.deepEqual(r.fields.filter(f=>f.label==='Query · a').map(f=>f.value),['one two','&']);assert.equal(value(r,'Fragment'),'#part');
  for(const url of ['example.com','javascript:alert(1)','https://user:secret@example.com']) assert.throws(()=>inspectURL({url}));
});
test('JSON formatting preserves numeric tokens, duplicate keys, escaped quotes and string whitespace',()=>{
  const text=' {"id":9007199254740993,"x":1e999,"id":-0,"t":" a \\"b\\" ","list":[{},[],null,true,false]} ';
  const min=value(formatJSON({text,format:'Minified'}),'Formatted JSON');
  assert.equal(min,text.trim());
  const pretty=value(formatJSON({text}),'Formatted JSON');assert.ok(pretty.includes('\n'));assert.match(pretty,/9007199254740993/);assert.match(pretty,/1e999/);
  assert.deepEqual(JSON.parse(pretty),JSON.parse(text));
  assert.equal(value(formatJSON({text:'null'}),'Formatted JSON'),'null');
  assert.throws(()=>formatJSON({text:'{"a":}'}),/Invalid JSON/);
  assert.throws(()=>formatJSON({text:'['.repeat(65)+'0'+']'.repeat(65)}),/64 levels/);
});
test('Base64 uses UTF-8 and strict canonical decoding; rejects binary and URL-safe input',()=>{
  for(const text of ['', 'hello','Grég 👋\nline 2']){
    const encoded=value(convertBase64({text}),'Output');assert.equal(encoded,Buffer.from(text).toString('base64'));
    assert.equal(value(convertBase64({text:encoded,mode:'Decode'}),'Output'),text);
  }
  for(const text of ['!!!!','_w==','/w==','Zh==','abc']) assert.throws(()=>convertBase64({text,mode:'Decode'}));
});
test('SHA hash matches known answers and includes exact UTF-8 whitespace',async()=>{
  for(const algorithm of ['SHA-256','SHA-384','SHA-512']){
    const r=await hashText({text:'abc',algorithm},{cryptoAPI:webcrypto});assert.equal(value(r,'Hex digest'),createHash(algorithm.replace('-','').toLowerCase()).update('abc').digest('hex'));
  }
  assert.equal(value(await hashText({text:'é\n'},{cryptoAPI:webcrypto}),'Input size'),'3 bytes');
  await assert.rejects(hashText({text:'abc'},{cryptoAPI:{}}),/unavailable/);
});
test('large local inputs are bounded before processing',async()=>{
  const text='x'.repeat(100001);
  assert.throws(()=>formatJSON({text}),/100,000/);assert.throws(()=>convertBase64({text}),/100,000/);await assert.rejects(hashText({text}),/100,000/);
});
