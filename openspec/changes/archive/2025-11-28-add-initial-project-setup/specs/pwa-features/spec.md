# Capability: PWA Features

**Domain**: Platform  
**Owner**: Platform Team  
**Status**: Active

## Overview

Fonctionnalités Progressive Web App (PWA) permettant d'installer l'application sur desktop/mobile, de fonctionner offline, de recevoir des notifications, et de gérer les mises à jour automatiquement via Service Worker et Workbox.

## ADDED Requirements

### Requirement: REQ-PWA-001: Installation comme Application Desktop

**Priority**: Critical  
**Status**: Active

The application MUST be installable as a native application on macOS, Windows and Linux via the standard PWA protocol.

**Details**:

- Web App Manifest complet (`manifest.json`)
- Icônes multiples résolutions (192x192, 512x512, maskable)
- Nom, description, couleurs de thème
- Display mode: `standalone`
- Scope et start_url configurés
- Service Worker requis pour installation

**Acceptance Criteria**:

- Manifest généré et servi correctement
- Bouton "Installer" apparaît dans le navigateur
- Installation fonctionne sur Chrome, Firefox, Safari, Edge
- Application s'ouvre en mode standalone (sans UI navigateur)
- Icône de l'app visible dans dock/barre des tâches

#### Scenario: Installation sur macOS

**Given**: L'utilisateur visite l'application sur Chrome macOS  
**When**: Il clique sur le bouton "Installer l'application"  
**Then**:

- L'application s'installe
- Une icône apparaît dans le Dock
- L'application peut se lancer depuis le Dock
- Elle s'ouvre en mode standalone (pas d'UI Chrome)
- Elle apparaît dans Applications

#### Scenario: Installation sur Windows

**Given**: L'utilisateur visite l'application sur Edge Windows  
**When**: Il installe l'application  
**Then**:

- L'app s'installe
- Un raccourci est créé sur le Bureau
- L'app apparaît dans le Menu Démarrer
- Elle peut être épinglée à la barre des tâches
- Elle fonctionne comme une app native

---

### Requirement: REQ-PWA-002: Fonctionnement Offline Complet

**Priority**: Critical  
**Status**: Active

The application MUST function entirely offline after the first installation, without requiring an internet connection.

**Details**:

- Service Worker avec stratégie Cache First
- Pré-cache de l'app shell (HTML, CSS, JS)
- Runtime cache pour assets dynamiques
- Offline page de fallback
- Détection de l'état online/offline
- UI feedback quand offline

**Acceptance Criteria**:

- Application fonctionne sans internet après installation
- Toutes les fonctionnalités CRUD disponibles offline
- Pas d'erreurs réseau visibles
- Indicateur d'état offline dans l'UI
- Données synchronisées localement via IndexedDB

#### Scenario: Utilisation offline après installation

**Given**: L'application est installée et a été utilisée une fois online  
**When**: L'utilisateur déconnecte internet et ouvre l'app  
**Then**:

- L'application démarre normalement
- Toutes les pages se chargent
- Les données IndexedDB sont accessibles
- CRUD fonctionne normalement
- Un indicateur "Offline" est visible (optionnel)

#### Scenario: Première visite offline

**Given**: L'utilisateur n'a jamais visité l'application  
**When**: Il tente d'y accéder sans internet  
**Then**:

- Une page offline de fallback s'affiche
- Un message explique qu'une connexion est requise pour la première visite
- Aucune erreur navigateur brute n'est affichée

---

### Requirement: REQ-PWA-003: Service Worker avec Workbox

**Priority**: Critical  
**Status**: Active

The application MUST use Workbox to manage the Service Worker with optimal cache strategies and an automatic update system.

**Details**:

- @vite-plugin/pwa configuré
- Workbox en mode `generateSW`
- Stratégies de cache:
  - App shell: Cache First
  - Assets (images, fonts): Cache First avec expiration
  - API calls (future): Network First
- Pré-caching automatique des assets build
- Skip waiting pour updates

**Acceptance Criteria**:

- Service Worker enregistré au démarrage
- Cache créé et populé
- Stratégies de cache fonctionnent
- Updates détectées automatiquement
- Service Worker activé dans tous les navigateurs supportés

#### Scenario: Enregistrement du Service Worker

**Given**: L'utilisateur visite l'application pour la première fois  
**When**: La page se charge  
**Then**:

- Le Service Worker s'enregistre automatiquement
- Le cache est créé
- Les assets de l'app shell sont pré-cachés
- Console confirme l'enregistrement (dev mode)
- L'application devient installable

#### Scenario: Chargement depuis le cache

**Given**: L'application a été visitée et le cache est populé  
**When**: L'utilisateur recharge la page  
**Then**:

- Les assets se chargent depuis le cache (pas de réseau)
- Le chargement est instantané
- Le Service Worker intercepte les requêtes
- Le cache est utilisé en priorité (Cache First)

---

### Requirement: REQ-PWA-004: Gestion des Mises à Jour

**Priority**: High  
**Status**: Active

The application MUST automatically detect new versions and prompt the user to update without data loss.

**Details**:

- Détection de nouveau Service Worker
- Notification de mise à jour disponible
- Bouton "Actualiser" pour appliquer l'update
- Skip waiting pour activation immédiate
- Reload automatique après update
- Pas de perte de données pendant l'update

**Acceptance Criteria**:

- Nouvelle version détectée automatiquement
- Notification affichée (toast/banner)
- Utilisateur peut accepter ou reporter
- Update appliquée sans perte de données
- Page rechargée avec nouvelle version

#### Scenario: Détection d'une nouvelle version

**Given**: Une nouvelle version de l'app est déployée  
**When**: L'utilisateur a l'ancienne version ouverte  
**Then**:

- Le navigateur détecte le nouveau Service Worker
- Une notification s'affiche: "Nouvelle version disponible"
- Un bouton "Actualiser" est proposé
- L'utilisateur peut continuer à travailler
- Les données locales sont préservées

#### Scenario: Application d'une mise à jour

**Given**: Une notification de mise à jour est affichée  
**When**: L'utilisateur clique sur "Actualiser"  
**Then**:

- Le nouveau Service Worker est activé (skip waiting)
- La page se recharge automatiquement
- La nouvelle version est active
- Les données IndexedDB sont intactes
- Pas d'erreurs ou d'état incohérent

---

### Requirement: REQ-PWA-005: Icônes et Splash Screens

**Priority**: Medium  
**Status**: Active

The application MUST have quality icons for all platforms and splash screens for a professional installation experience.

**Details**:

- Icônes:
  - 192x192 (Android)
  - 512x512 (Android, Desktop)
  - Maskable icon (Android adaptive)
  - Apple touch icon (iOS)
  - Favicon (browser)
- Splash screens (optionnel iOS)
- Couleurs de thème (theme_color, background_color)

**Acceptance Criteria**:

- Toutes les icônes générées
- Icônes optimisées (SVG → PNG)
- Manifest référence les icônes correctement
- Icônes affichées dans l'OS
- Splash screen s'affiche au lancement (si supporté)

#### Scenario: Affichage de l'icône sur macOS

**Given**: L'application est installée sur macOS  
**When**: L'utilisateur regarde le Dock  
**Then**:

- L'icône de Locapilot est visible
- L'icône est nette (résolution appropriée)
- Les couleurs sont correctes
- L'icône correspond à l'identité visuelle

---

### Requirement: REQ-PWA-006: Manifest Configuration

**Priority**: High  
**Status**: Active

The Web App Manifest MUST be complete and optimized for an optimal installation experience on all platforms.

**Details**:

```json
{
  "name": "Locapilot - Gestion Locative",
  "short_name": "Locapilot",
  "description": "Application de gestion locative offline-first",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#your-color",
  "background_color": "#ffffff",
  "icons": [...],
  "categories": ["productivity", "finance"],
  "lang": "fr"
}
```

**Acceptance Criteria**:

- Manifest valide (validateur Google)
- Tous les champs requis présents
- Icônes de toutes tailles disponibles
- Display mode standalone
- Score Lighthouse PWA > 90

#### Scenario: Validation du manifest

**Given**: Le manifest est configuré  
**When**: On utilise le validateur PWA  
**Then**:

- Aucune erreur n'est reportée
- Tous les champs requis sont présents
- Les icônes sont accessibles
- Le score est > 90/100

---

### Requirement: REQ-PWA-007: Détection de l'État Réseau

**Priority**: Medium  
**Status**: Active

The application MUST detect online/offline status and adapt the UI accordingly to inform the user.

**Details**:

- Utilisation de `navigator.onLine`
- Événements `online` et `offline`
- Indicateur visuel dans l'UI (badge, banner)
- Désactivation de features nécessitant le réseau (si futures)
- Composable `useNetworkStatus()`

**Acceptance Criteria**:

- État réseau détecté correctement
- UI mise à jour quand réseau change
- Indicateur visible quand offline
- Pas d'erreurs réseau non gérées

#### Scenario: Passage en mode offline

**Given**: L'application est ouverte avec internet  
**When**: L'utilisateur déconnecte internet  
**Then**:

- Un badge "Offline" apparaît (ex: dans le header)
- Les fonctionnalités offline continuent de fonctionner
- Pas de tentatives réseau inutiles
- Un toast peut informer l'utilisateur (optionnel)

#### Scenario: Retour en mode online

**Given**: L'application est en mode offline  
**When**: L'internet revient  
**Then**:

- Le badge "Offline" disparaît ou devient "Online"
- Les fonctionnalités réseau sont réactivées (si futures)
- Un toast peut confirmer la reconnexion (optionnel)

---

### Requirement: REQ-PWA-008: Score Lighthouse PWA

**Priority**: High  
**Status**: Active

The application MUST achieve a Lighthouse PWA score above 90 to ensure PWA best practices.

**Details**:
Critères Lighthouse:

- ✅ Service Worker enregistré
- ✅ Répond avec 200 quand offline
- ✅ Manifest valide
- ✅ Icônes appropriées
- ✅ Splash screen
- ✅ Theme color
- ✅ Viewport configuré
- ✅ HTTPS (en production)

**Acceptance Criteria**:

- Score PWA > 90/100
- Tous les critères Lighthouse passent
- Warnings minimaux ou nuls
- Application installable

#### Scenario: Audit Lighthouse

**Given**: L'application est en production  
**When**: On exécute un audit Lighthouse  
**Then**:

- Le score PWA est > 90
- Performance > 80 (bonus)
- Accessibility > 90 (bonus)
- Best Practices > 90
- Pas de critère PWA échoué

---

## Dependencies

**Internal**:

- core-infrastructure (Vite, build setup)

**External**:

- @vite-plugin/pwa ^0.20.0
- workbox-window (via plugin)

## Risks

- **Compatibilité Safari**: PWA support limité → Tests sur iOS/macOS
- **Quota storage**: Limite browser → Monitoring + cleanup
- **Service Worker bugs**: Tests rigoureux cross-browser
- **Update conflicts**: Skip waiting + gestion d'état

## Performance Targets

- Service Worker registration: < 500ms
- Cache hit: < 10ms
- App shell load (cached): < 500ms
- Update detection: < 5s après déploiement

## Security

- HTTPS obligatoire en production (requis PWA)
- Service Worker scope limité
- Cache pollution prevention
- CSP (Content Security Policy) compatible

## Accessibility

- Installation accessible au clavier
- Notifications de mise à jour accessibles
- Pas de reliance unique sur les couleurs pour état réseau

## Observability

- Service Worker lifecycle logs
- Cache hit/miss metrics
- Update events tracking
- Install analytics (optionnel, privacy-friendly)
