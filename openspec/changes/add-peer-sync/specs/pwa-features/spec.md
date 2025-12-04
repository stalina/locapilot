## ADDED Requirements

### Requirement: Peer-to-peer DB synchronization

The system SHALL provide a peer-to-peer synchronization feature from the Settings page that allows exporting the full IndexedDB database from one browser and importing it into another using PeerJS.

#### Scenario: Host creates a peer channel

- **WHEN** a user selects to host a sync session in the Settings page
- **THEN** the application SHALL generate a PeerJS channel ID in the format `lcp-<version>-<hh-mm-sss>-<random3>` and display it to the user

#### Scenario: Client connects to host

- **WHEN** a user enters a host ID in the Settings page
- **THEN** the application SHALL verify the version embedded in the ID matches the running app version
- **AND** if versions mismatch the application SHALL show an update message and block the connection
- **AND** otherwise the application SHALL connect to the host PeerJS channel

#### Scenario: Host sends export and client imports

- **WHEN** the PeerJS connection opens on the host
- **THEN** the host SHALL send the JSON export produced by the app export flow
- **WHEN** the client receives the export JSON
- **THEN** the client SHALL ask the user for confirmation before clearing and importing data
- **AND** if the user accepts the client SHALL import the data using the same logic as the app's import flow

## MODIFIED Requirements

### Requirement: Encrypted Peer-to-peer Transfer

Peer-to-peer messages used for database synchronization SHALL be encrypted using a symmetric key derived from multiple components.

The encryption key SHALL be derived from the concatenation of the following values (in this order):

- the application name (from `package.json` `name`)
- the application version (injected at build time via `import.meta.env.__APP_VERSION__`)
- a build-time secret key (`BUILD_SECRET_KEY`) provided as an environment variable at build time and injected into the runtime via Vite `define`

Each message payload SHALL also include a numeric `timestamp` (milliseconds since epoch) generated at send-time. The timestamp SHALL be part of the encrypted content so the recipient can extract it after decryption.

Encryption details:

- The sender SHALL derive the symmetric key by concatenating the three build-time values, then applying a secure KDF (for example, HKDF with SHA-256) to produce a 256-bit AES key.
- The sender SHALL generate a fresh random nonce/IV for each message and include the IV (unencrypted) alongside the ciphertext so the recipient can decrypt.
- The message object sent over PeerJS SHALL have the shape: `{ type: 'export', iv: '<base64>', payload: '<base64-ciphertext>' }` where `payload` is the encrypted JSON export containing the `timestamp` field.
- On receive, the client SHALL reconstruct the symmetric key using the same deterministic inputs (name, version, build secret), use the provided IV to decrypt the payload, parse the JSON, validate presence of `timestamp`, and then prompt the user to confirm import.

Security requirements:

- The `BUILD_SECRET_KEY` MUST not be committed to source control; it is injected at CI/CD build time and kept secret.
- The system SHALL reject decryption attempts that fail integrity checks or where the `timestamp` is missing or malformed.
- Clock skew handling: recipients SHALL accept timestamps within a reasonable window (e.g. ±5 minutes). If outside this window, the recipient SHALL warn the user and require explicit confirmation.

#### Scenario: Encrypted transfer

- **WHEN** the host PeerJS connection opens
- **THEN** the host SHALL build the export JSON, include a `timestamp`, encrypt the payload as described, and send an object `{ type:'export', iv, payload }`
- **WHEN** the client receives the encrypted object
- **THEN** the client SHALL attempt to decrypt using the derived key, validate the `timestamp`, prompt the user, and if accepted import the data
