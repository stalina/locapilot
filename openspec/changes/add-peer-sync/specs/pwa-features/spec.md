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
