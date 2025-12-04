# Change: add-peer-sync

## Why

Permettre à l'utilisateur de synchroniser directement la base de données IndexedDB entre deux navigateurs via une connexion peer-to-peer, sans serveur central, pour faciliter le transfert de données entre appareils.

## What Changes

- Ajout d'une nouvelle capacité de synchronisation P2P basée sur PeerJS accessible depuis la page `Settings` sous la section `Import/Export`.
- Ajout de l'UI pour héberger un canal (génération d'un ID lisible) ou se connecter à un canal existant.
- Validation de version de l'application avant connexion.
- Envoi de l'export JSON depuis le navigateur hôte et import côté client après confirmation utilisateur.

## Impact

- Affected specs: `pwa-features`, `database-layer` (delta)
- Affected code: `src/features/settings/views/SettingsView.vue`, `package.json`
