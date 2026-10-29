# v0.2 verification · 2026-10-29

## Executed locally

- `npm test`: deterministic capability, subnet, input-validation, DNS/IP transport and service-worker tests pass.
- `npm run check`: JavaScript syntax, required assets, relative standalone manifest, shell precache coverage and safe DOM rendering checks pass.
- Subnet known answers cover /0, /24, /31, /32 and high-bit IPv4. Invariants exercised across every prefix 0–32.
- Mocked DNS covers success/records/TTL, NXDOMAIN, empty success, SERVFAIL, malformed payloads and unsupported input. This does not establish live-provider reachability.
- Mocked IP covers IPv4/IPv6 endpoints and invalid outputs. Fetch tests exercise HTTP 429, network failure, timeout and cancellation.
- Service-worker VM tests exercise local asset precache, unrelated-cache preservation, external bypass and cached navigation/module responses. These are not browser-runtime evidence.
- Source self-review: no private engine code, credentials, analytics, raw sockets, implicit external calls, guessed gateway or local subnet. External strings rendered with textContent.

## Environment limits

Local Playwright launch was attempted but Chromium was absent. Its download returned a truncated/non-ZIP response. Live ipify transport returned HTTP 520 through this environment. Consequently local visual/mobile runtime, live API CORS, installed PWA and old-to-new worker lifecycle are not claimed as passed here.

## Preview acceptance checklist

1. Open the Pages link on desktop and phone; ensure no sideways overflow at 320–390 px or 200% zoom, and keyboard focus is visible.
2. Enter example.com / A, run explicitly and verify returned record/TTL/provider. Test a nonexistent name, offline retry, cancellation and changing tools while a request runs.
3. Run IPv4 Public IP and optional IPv6. Treat an IPv6 failure as inconclusive. Confirm the provider disclosure before starting.
4. Calculate 192.168.1.10/24; expect network .0, broadcast .255, host range .1–.254, 254 conventional usable hosts. Try /31 and /32 and malformed input.
5. Copy result, use technical details, navigate between tools and verify drafts persist during the session.
6. Install from browser menu. After one cached online load, enable flight mode, reopen and calculate a subnet. DNS/Public IP should fail clearly while offline.
7. With two old tabs open, verify a new worker waits; close both and reopen to get the new version without stale mixed assets.

Status: source verified development preview; physical-device acceptance and full browser/runtime verification pending. No independent reviewer sign-off claimed.
