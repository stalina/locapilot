# Architecture Decision Records (ADR)

Un **ADR** documente une décision d'architecture structurante : son contexte, la
décision retenue, les alternatives écartées et les conséquences. L'objectif est
de garder la trace du _pourquoi_ d'un choix, pas seulement du _comment_.

## Convention

- Un fichier par décision, nommé `NNNN-titre-en-kebab-case.md` (numéro à 4
  chiffres, croissant).
- Une décision publiée n'est **pas modifiée** : si elle évolue, on crée un
  nouvel ADR qui la remplace (et on passe le statut de l'ancien à `Remplacé par
ADR-XXXX`).
- Statuts possibles : `Proposé`, `Accepté`, `Déprécié`, `Remplacé`.
- Utiliser le [gabarit](./template.md) comme point de départ.

## Index

| N°                                              | Titre                                           | Statut  |
| ----------------------------------------------- | ----------------------------------------------- | ------- |
| [0001](./0001-offline-first-indexeddb.md)       | Offline-first avec IndexedDB (Dexie)            | Accepté |
| [0002](./0002-synchronisation-p2p-chiffree.md)  | Synchronisation P2P chiffrée (PeerJS + AES-GCM) | Accepté |
| [0003](./0003-migrations-declaratives-dexie.md) | Migrations déclaratives via Dexie               | Accepté |
| [0004](./0004-pwa-service-worker-workbox.md)    | PWA installable avec Service Worker (Workbox)   | Accepté |
