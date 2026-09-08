# Network Knackers Web

Public, installable PWA prototype for the Network Knackers network action deck.

v0.1 deliberately exposes only browser-safe observations. It does not guess a default gateway, local IP, subnet, or device list. Protected/native engine work belongs in the private `langzonedev/NetworkKnackers` repository.

## Run and verify

```bash
npm test
npm run check
```

Serve the directory over HTTP(S) to exercise the service worker. GitHub Pages must publish from the repository root.

No production release is implied by source or test success.
