# Documentation technique — Locapilot

Cette section regroupe la documentation technique de Locapilot : décisions
d'architecture (ADR), vue d'ensemble de l'architecture et fonctionnement du
système de migrations de la base de données.

> Pour la **documentation fonctionnelle** (modèles de données, règles métier,
> user stories), voir le dossier [`specs/`](../specs/_index.md).
> Pour les **conventions de code et patterns**, voir
> [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

## Sommaire

### Vue d'ensemble

- [Architecture](./architecture.md) — diagramme des couches, flux de données,
  frontières PWA et canal de synchronisation P2P.
- [Système de migrations Dexie](./migrations-dexie.md) — historique des
  versions du schéma, fonctionnement des `upgrade()`, guide pour ajouter une
  migration.

### Décisions d'architecture (ADR)

Les ADR (_Architecture Decision Records_) documentent les choix structurants :
le contexte, la décision prise, et ses conséquences. Voir
[l'index des ADR](./adr/README.md).

| ADR                                                 | Titre                                           | Statut  |
| --------------------------------------------------- | ----------------------------------------------- | ------- |
| [0001](./adr/0001-offline-first-indexeddb.md)       | Offline-first avec IndexedDB (Dexie)            | Accepté |
| [0002](./adr/0002-synchronisation-p2p-chiffree.md)  | Synchronisation P2P chiffrée (PeerJS + AES-GCM) | Accepté |
| [0003](./adr/0003-migrations-declaratives-dexie.md) | Migrations déclaratives via Dexie               | Accepté |
| [0004](./adr/0004-pwa-service-worker-workbox.md)    | PWA installable avec Service Worker (Workbox)   | Accepté |
