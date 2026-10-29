# Public capability catalogue · v0.2

Behavioural alignment with the private `langzonedev/NetworkKnackers` architecture; no private engine source is copied here. IDs remain stable across platforms, not necessarily UI implementation or OS output fields.

## Contract

Module: `id`, `title`, `description`, `category`, `availability`, `requirements`, `activity`, optional declarative `inputs`, `disclosure`, and `run({navigator,input,signal})`.

Result: `status: success | unsupported | error`, `title`, `summary`, `fields: [{label,value,detail,kind}]`, `note`, optional `raw`, optional ISO `checkedAt`. `kind`: observed, estimated, derived, user-supplied, unavailable (legacy warning retained for offline hint). Derived subnet values are labelled Calculated in UI. Network requests have an 8-second timeout and cancellation. `checkedAt` is client observation time, not provider authority time.

`availability` describes this adapter, not every platform. Inputs are validated before remote calls. Browser/native adapters must preserve success/unsupported/error meanings; native preview fields do not yet implement this entire catalogue. No assertion of native feature delivery is implied by the table.

| ID | PWA input → result | Activity / privilege | Provenance / privacy | Native / desktop mapping |
|---|---|---|---|---|
| connection.snapshot | none → browser hints, estimates, explicit unavailable fields | Passive / browser | navigator APIs; device only | Android OS adapter exists; desktop OS adapter planned |
| public_ip.lookup | family 4 or 6 → public address | Active / outbound HTTPS | ipify sees public exit address; no stored history | Future equivalent remote adapter; public IP still requires remote observation |
| dns.resolve | DNS name, record type → response code, records, TTL, raw response | Active / outbound HTTPS | Cloudflare sees public IP and query; recursive resolver observation, not system DNS | Future configured/selectable resolver adapters |
| subnet.calculate | IPv4/prefix → network, mask, wildcard, range, hosts | Passive / none | Local math on supplied input; not an observed subnet | Future shared conceptual calculator |
| gateway.identify | none → next hops | Native-required in Web | Never guessed; Android reads OS routes | Android implemented; desktop planned |
| devices.discover | explicit authorised scope → devices/services | Planned / native network access | Explicit user initiation required | Future native/desktop |
| diagnostics.run | explicit target → diagnostic bundle | Planned | No implied browser diagnostics | Retained legacy ID; targeted tools may compose beneath it |

Reserved roadmap IDs: `dns.reverse`, `dns.compare`, `ip.rdap`, `domain.rdap`, `http.inspect`, `tls.inspect`, `latency.http`, `port.reference`, `icmp.ping`, `route.trace`, `services.discover`, `wifi.inspect`. Not implemented in this increment.

## Remote provider boundary

- ipify: `https://api.ipify.org?format=json` (IPv4), `https://api6.ipify.org?format=json` (IPv6 only). One selected request per run. Failure on IPv6 does not establish lack of IPv6; proxies, filtering, provider availability and browser restrictions can also cause failure.
- Cloudflare: `https://cloudflare-dns.com/dns-query?name=…&type=…`, Accept `application/dns-json`. A, AAAA, CNAME, MX, TXT, NS, SOA, SRV and PTR query names supported. PTR currently takes a reverse-zone name, not an IP-conversion flow. NXDOMAIN and successful empty answers are separate from SERVFAIL and transport failure.
- Credentials omitted; referrer omitted; no-store requests. External responses bypass service worker. Results/drafts exist in memory until reload; copy explicitly exports selected results to the device clipboard. There is no analytics, saved history, account or Lang Systems proxy.
- Provider terms and privacy are outside this app's control. API/policy references reviewed 2026-10-29: [ipify API and stated logging policy](https://www.ipify.org/), [Cloudflare JSON API](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/), [Cloudflare resolver privacy](https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/), [Cloudflare resolver terms](https://developers.cloudflare.com/1.1.1.1/terms-of-use/).

HTTP headers, redirect chains and TLS certificate inspection require a separately reviewed backend/native boundary. No arbitrary URL proxy, raw sockets or CORS bypass is introduced.


## v0.3 extension

See [v0.3 capability additions and provider boundary](V0.3.md). Eight tools add reverse DNS, resolver comparison, IPv6 ranges, common ports, URL inspection, JSON, Base64 and SHA. New local adapters remain public/generic. Google DoH is user-initiated and disclosed; no proprietary/native code or raw sockets are introduced. Android has not gained these features merely because their IDs are catalogued here.
