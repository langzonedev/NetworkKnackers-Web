# Network Knackers Web

**[Open the PWA / install on mobile](https://langzonedev.github.io/NetworkKnackers-Web/)**

v0.2.1 development preview: an approachable, browser-safe network toolkit. Public preview publication was requested by Greg on 2026-10-29; this is not a commercial production launch.

## Use it

Open the link in your mobile browser. In Chrome, use the browser menu → **Add to Home screen / Install app** when offered. Other browsers use their equivalent installation action. Installation requires HTTPS and browser support; it has not yet been confirmed on a physical phone for this version.

- **My Connection:** browser hints and labelled connection estimates.
- **Public IP:** user-initiated IPv4 or IPv6 lookup via ipify.
- **DNS Lookup:** A, AAAA, CNAME, MX, TXT, NS, SOA, SRV or PTR via Cloudflare DNS-over-HTTPS.
- **Subnet / CIDR:** local IPv4 calculations including /0, /31 and /32. Works offline once the shell is cached.

Search/filter tools, keep inputs while switching tools, cancel network checks, copy results with provenance, expand raw DNS details. Nothing is queried automatically on page load.

Online tools disclose their provider before running. They send your public IP, and for DNS your query name, to that provider. Results are held in memory only. Network checks need internet access; no stale provider results are served from cache.

## PWA / updates

Relative paths support GitHub Pages project hosting. PNG icons at 192 and 512 pixels accompany the standalone manifest. The service worker precaches only app assets, bypasses external requests, and waits for old tabs to close before activating an update. Close all app/browser tabs and reopen to receive a waiting version. If upgrading the v0.1 preview, reload once after its old worker has updated. If it still shows v0.1, clear this site’s cached data and reopen.

## Develop and verify

Node 20+: `npm test` and `npm run check`. Serve this directory over localhost, for example `python -m http.server 8765`, for browser/PWA testing. No build or runtime dependencies.

See [capability catalogue and platform matrix](docs/CAPABILITY_CATALOGUE.md), [audit, decisions and roadmap](docs/V0.2_AUDIT.md) and [verification status](docs/QA_V0.2.md). The private [NetworkKnackers repository](https://github.com/langzonedev/NetworkKnackers) remains authoritative for protected/native architecture. No local IP, gateway, routing table, configured DNS or discovered devices are guessed by this Web app.
