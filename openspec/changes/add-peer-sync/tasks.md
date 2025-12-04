## 1. Implementation

- [x] 1.1 Add dependency `peerjs` to `package.json`
- [x] 1.2 Add UI controls to `SettingsView.vue` for Host / Connect
- [x] 1.3 Implement PeerJS host and client logic to exchange export JSON
- [x] 1.4 Reuse existing import/export logic to rebuild Blobs and import data
- [x] 1.5 Add basic user messages and safeguards (version mismatch, confirmations)

## 2. Testing

- [ ] 2.1 Manual test: Host in Browser A, connect from Browser B, complete sync
- [ ] 2.2 Unit tests: none required (UI flows), manual verification documented

## 3. Documentation

- [x] 3.1 Add short note to `proposal.md` summarizing usage

## Dev Notes

- The implementation adds PeerJS usage directly in `SettingsView.vue` with a simple host/client flow.
- Peer channel IDs follow `lcp-1.0-hh-mm-ss-<rand3>` pattern; app version is embedded for validation.
- The export JSON generation is reused via `buildExportPayload()` and import via `performImportFromObject()`.
- No server signaling changes are required; PeerJS public broker will be used by default. For production, consider a self-hosted PeerServer.
