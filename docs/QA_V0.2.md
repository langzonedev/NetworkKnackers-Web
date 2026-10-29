# v0.2 verification · 2026-10-29

## Executed locally

- `npm test`: deterministic capability, subnet, input-validation, DNS/IP transport and service-worker tests pass.
- `npm run check`: JavaScript syntax, required assets, relative standalone manifest, shell precache coverage and safe DOM rendering checks pass.
- Subnet known answers cover /0, /24, /31, /32 and high-bit IPv4. Invariants exercised across every prefix 0–32.
- Mocked DNS covers success/records/TTL, NXDOMAIN, empty success, SERVFAIL, malformed payloads and unsupported input. This does not establish live-provider reachability.
- Mocked IP covers IPv4/IPv6 endpoints and invalid outputs. Fetch tests exercise HTTP 429, network failure, timeout and cancellation.
- Service-worker VM tests exercise local asset precache, unrelated-cache preservation, external bypass and cached navigation/module responses. These are not browser-runtime evidence.
- Source self-review: no private engine code, credentials, analytics, raw sockets, implicit external calls, guessed gateway or local subnet. External strings rendered with textContent.

## Published preview evidence

- Web PR #1 merged as `66e4a280ab2f6e0b71b9989a7706ca09259f6611`. Asset-version migration fix `3f2a7bed7e958800971b5baf03eb0774cec2f876` publishes v0.2.1. GitHub Pages run `40819746573` completed successfully.
- Cloud-browser runtime inspection initially saw new HTML paired with old cached app.js (null element listener error). Added explicit version queries to HTML asset URLs, module imports and shell precache, and bumped cache/version. Re-ran all 16 tests and static checks successfully.
- The existing cloud-browser profile initially continued to render cached v0.1 content. After closing its PWA tabs and reopening, v0.2.1 rendered correctly. Executed on the published HTTPS site in the remote cloud browser: default /24 calculation returned network 192.168.1.0/24, broadcast .255, host range .1–.254 and 254 hosts; Copy result displayed success; live example.com A lookup returned NOERROR with two records and TTL/provider labels; live ipify IPv4 lookup returned a validated public address with provenance. Desktop screenshot reviewed for layout. These are cloud-browser observations, not Samsung/device tests. If an existing installation remains on v0.1, close all app tabs/reopen; clear only this site’s cached data if needed.

## Environment limits

Local Playwright launch was attempted but Chromium was absent. Its download returned a truncated/non-ZIP response. Live ipify transport returned HTTP 520 through this environment. The separate remote-browser smoke above subsequently verified desktop rendering and live IPv4/DNS CORS from that browser. Mobile runtime, physical installation, offline runtime and comprehensive multi-tab worker lifecycle testing remain pending.

## Preview acceptance checklist

1. Open the Pages link on desktop and phone; ensure no sideways overflow at 320–390 px or 200% zoom, and keyboard focus is visible.
2. Enter example.com / A, run explicitly and verify returned record/TTL/provider. Test a nonexistent name, offline retry, cancellation and changing tools while a request runs.
3. Run IPv4 Public IP and optional IPv6. Treat an IPv6 failure as inconclusive. Confirm the provider disclosure before starting.
4. Calculate 192.168.1.10/24; expect network .0, broadcast .255, host range .1–.254, 254 conventional usable hosts. Try /31 and /32 and malformed input.
5. Copy result, use technical details, navigate between tools and verify drafts persist during the session.
6. Install from browser menu. After one cached online load, enable flight mode, reopen and calculate a subnet. DNS/Public IP should fail clearly while offline.
7. With two old tabs open, verify a new worker waits; close both and reopen to get the new version without stale mixed assets.

Status: source verified and cloud-browser smoke verified development preview; physical-device acceptance, offline runtime and full lifecycle verification pending. No independent reviewer sign-off claimed.
