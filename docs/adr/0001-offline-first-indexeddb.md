# ADR 0001 — Offline-first avec IndexedDB (Dexie)

- **Statut** : Accepté
- **Date** : 2026-06-29

## Contexte

Locapilot vise les bailleurs particuliers et petits gestionnaires qui doivent
pouvoir consulter et saisir des données (visites, états des lieux, encaissements)
y compris **sans connexion** (cave d'immeuble, déplacement, zone blanche). Les
données gérées sont **personnelles et sensibles** (locataires, revenus,
documents d'identité), ce qui plaide pour qu'elles ne quittent pas l'appareil de
l'utilisateur.

Contraintes :

- Fonctionnement total hors ligne, y compris au premier lancement.
- Pas de coût ni de maintenance d'infrastructure serveur.
- Volumes potentiellement importants (documents PDF, photos sous forme de
  `Blob`).
- Confidentialité : minimiser la surface d'exposition des données.

## Décision

Adopter une architecture **offline-first sans backend** : toutes les données
sont stockées **localement dans IndexedDB**, via la bibliothèque **Dexie.js**
qui en fournit une API typée et ergonomique. L'application est une **PWA**
installable (voir [ADR 0004](./0004-pwa-service-worker-workbox.md)).

IndexedDB est la **source de vérité unique**. Il n'y a pas de couche serveur ;
le partage de données entre appareils est traité comme un cas explicite et
optionnel (voir [ADR 0002](./0002-synchronisation-p2p-chiffree.md)).

## Alternatives envisagées

- **Backend classique (API REST + base serveur)** — rejeté : coût et
  maintenance d'infrastructure, nécessite une connexion, centralise des données
  sensibles, complexifie le RGPD.
- **`localStorage`** — rejeté : API synchrone, limité à ~5 Mo, stocke uniquement
  des chaînes (inadapté aux `Blob` de documents).
- **IndexedDB brut (sans Dexie)** — rejeté : API verbeuse et basée sur des
  événements, sujette aux erreurs ; Dexie apporte les transactions, les types
  TypeScript et un système de versions/migrations.
- **SQLite via WASM** — rejeté : surcoût de bundle et complexité supérieurs au
  besoin, moins bien intégré au modèle objet de l'app.

## Conséquences

### Positives

- Application utilisable hors ligne immédiatement, sans latence réseau.
- Aucune infrastructure serveur à exploiter ou sécuriser.
- Données qui restent par défaut sur l'appareil de l'utilisateur.
- Dexie fournit transactions atomiques multi-tables, types et migrations
  déclaratives ([ADR 0003](./0003-migrations-declaratives-dexie.md)).

### Négatives / compromis

- **Pas de contraintes de clés étrangères** dans IndexedDB : les relations
  (property ↔ lease ↔ tenant ↔ rent) sont maintenues manuellement, les
  jointures se font via `bulkGet()`. Risque d'incohérence à gérer côté services.
- **Pas de synchronisation automatique** : le multi-appareil nécessite un
  mécanisme dédié (P2P) et un export/import.
- Données liées au navigateur/appareil : effacer les données du site = perte ;
  d'où l'importance de la sauvegarde/restauration et de l'export.
- Pas de requêtes serveur agrégées : les KPI du tableau de bord sont calculés
  côté client.

## Références

- [`src/db/schema.ts`](../../src/db/schema.ts), [`src/db/database.ts`](../../src/db/database.ts)
- Pattern d'accès : couche `repositories/` par feature (voir [architecture.md](../architecture.md))
- Règles métier : dossier [`specs/`](../../specs/_index.md)
