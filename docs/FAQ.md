# FAQ - Locapilot

Questions fréquemment posées sur Locapilot.

---

## Table des matières

- [Général](#général)
- [Installation et compatibilité](#installation-et-compatibilité)
- [Données et confidentialité](#données-et-confidentialité)
- [Fonctionnalités](#fonctionnalités)
- [Problèmes techniques](#problèmes-techniques)
- [Contribution et développement](#contribution-et-développement)

---

## Général

### Qu'est-ce que Locapilot ?

**Locapilot** est une application web progressive (PWA) open-source de gestion locative. Elle permet aux propriétaires de gérer leurs biens immobiliers, locataires, baux, loyers et documents, le tout **hors ligne** et **localement** sur leur appareil.

### Est-ce que Locapilot est gratuit ?

**Oui**, complètement gratuit et **open-source** (licence MIT).

- ✅ Aucun abonnement
- ✅ Aucune publicité
- ✅ Aucune limite de propriétés/locataires
- ✅ Code source accessible sur [GitHub](https://github.com/stalina/locapilot)

### Quelle est la différence entre Locapilot et d'autres solutions ?

| Caractéristique      | Locapilot       | Solutions cloud    | Logiciels desktop        |
| -------------------- | --------------- | ------------------ | ------------------------ |
| **Gratuit**          | ✅ Oui          | ⚠️ Freemium/Payant | ⚠️ Licence payante       |
| **Offline**          | ✅ 100%         | ❌ Non             | ✅ Oui                   |
| **Installation**     | ✅ Simple (PWA) | ❌ Compte requis   | ⚠️ Installation complexe |
| **Données locales**  | ✅ Oui          | ❌ Cloud           | ✅ Oui                   |
| **Multi-plateforme** | ✅ Oui          | ✅ Web             | ❌ OS spécifique         |
| **Open-source**      | ✅ Oui          | ❌ Non             | ❌ Non                   |

**Locapilot est idéal si vous voulez** :

- Gérer vos locations gratuitement
- Garder vos données privées (locales)
- Fonctionner hors ligne
- Application légère et rapide

**Limitations** : Pas de synchronisation cloud automatique (export/import manuel).

### À qui s'adresse Locapilot ?

**Public cible** :

- 🏠 **Propriétaires-bailleurs particuliers** (1-20 logements)
- 👨‍👩‍👧 **Gestion familiale** (biens en héritage, famille)
- 🏘️ **Petites agences immobilières** (gestion locale)
- 🧑‍💼 **Indépendants** (investissement locatif)

**Moins adapté pour** :

- ❌ Grandes agences (>50 biens, besoin CRM avancé)
- ❌ Gestion multi-utilisateurs (comptables, assistants)
- ❌ Besoin synchronisation cloud automatique

---

## Installation et compatibilité

### Sur quels appareils puis-je utiliser Locapilot ?

**Compatible** :

- 💻 **Ordinateurs** : Windows, macOS, Linux
- 📱 **Smartphones** : Android, iOS
- 📲 **Tablettes** : iPad, tablettes Android, Windows

**Navigateurs requis** :

- ✅ Chrome (recommandé)
- ✅ Edge
- ✅ Safari (macOS/iOS)
- ⚠️ Firefox (support PWA limité)

Consultez le [Guide d'Installation](./INSTALLATION.md) pour détails.

### Faut-il une connexion Internet pour utiliser Locapilot ?

**Non** après installation.

- 🌐 **Internet requis** : Uniquement pour la première installation
- ✅ **Fonctionne 100% hors ligne** ensuite
- 🔄 **Mises à jour** : Nécessitent connexion (optionnelles)

**Cas d'usage hors ligne** :

- Gestion propriétés, locataires, baux
- Enregistrement paiements loyers
- Upload documents
- Export/import données

### Combien d'espace Locapilot prend-il sur mon appareil ?

**Taille approximative** :

- 📦 **Application** : ~2-5 MB
- 📄 **Vos données** : Variable (dépend du nombre de propriétés, documents)

**Exemple** :

- 10 propriétés + 20 locataires + 50 baux + 100 documents (PDFs 1MB chacun) ≈ **105 MB**

**Limite** : Quota du navigateur (~50% espace disque disponible, généralement plusieurs Go).

### Puis-je utiliser Locapilot sur plusieurs appareils ?

**Oui**, mais sans synchronisation automatique.

**Workflow** :

1. **Appareil A** (principal) : Utilisez Locapilot normalement
2. **Exporter** les données (Paramètres → Exporter)
3. **Transférer** le fichier JSON vers l'appareil B (email, cloud, USB)
4. **Appareil B** : Importer les données (Paramètres → Importer)

**Fréquence recommandée** : Synchronisation manuelle hebdomadaire ou mensuelle.

**Alternative future** : Synchronisation cloud optionnelle (roadmap).

---

## Données et confidentialité

### Où sont stockées mes données ?

**100% locales** sur votre appareil (navigateur).

**Technologie** : IndexedDB (base de données du navigateur)

**Emplacement physique** :

- **Windows** : `C:\Users\<user>\AppData\Local\<browser>\IndexedDB\`
- **macOS** : `~/Library/Application Support/<browser>/IndexedDB/`
- **Linux** : `~/.config/<browser>/IndexedDB/`
- **Android/iOS** : Stockage interne de l'application

**Important** : Aucune donnée n'est envoyée vers un serveur.

### Mes données sont-elles sécurisées ?

**Oui**, par conception.

**Sécurité** :

- ✅ **Stockage local** : Pas de transmission réseau
- ✅ **Isolation navigateur** : Protégé par sandbox du navigateur
- ✅ **HTTPS** : Application servie en HTTPS (chiffrement)
- ✅ **Pas de compte** : Pas de mot de passe à voler

**Risques** :

- ⚠️ **Accès physique** : Si quelqu'un accède à votre appareil déverrouillé
- ⚠️ **Malware** : Malware sur l'appareil pourrait lire IndexedDB

**Bonnes pratiques** :

- 🔒 Verrouillez votre appareil
- 💾 Exportez régulièrement vos données
- 🔐 Chiffrez vos sauvegardes (ZIP avec mot de passe)

### Que se passe-t-il si je désinstalle l'application ?

**⚠️ Toutes les données sont supprimées**.

**Prévention** :

1. **Exporter** vos données **avant** désinstallation (Paramètres → Exporter)
2. Sauvegarder le fichier JSON en lieu sûr
3. Réimporter après réinstallation si besoin

**Tip** : Exportez régulièrement (1x/semaine) même si vous ne prévoyez pas de désinstaller.

### Puis-je partager mes données avec mon comptable ?

**Oui**, via export.

**Workflow** :

1. **Exporter** vos données (Paramètres → Exporter)
2. **Envoyer** le fichier JSON à votre comptable (email sécurisé, Wetransfer, etc.)
3. Votre comptable **importe** dans sa propre installation Locapilot

**Alternative** : Export manuel en tableur (feature future).

### Est-ce que Locapilot collecte des données d'utilisation ?

**Non**, aucune télémétrie.

**Aucune donnée** n'est collectée :

- ❌ Pas d'analytics (Google Analytics, etc.)
- ❌ Pas de tracking utilisateur
- ❌ Pas de cookies tiers
- ❌ Pas de logs serveur (pas de serveur !)

**Seules cookies** : Cookies techniques du service worker PWA (nécessaires fonctionnement offline).

---

## Fonctionnalités

### Combien de propriétés puis-je gérer ?

**Illimité** (dans la limite du quota navigateur).

**Testé avec** :

- ✅ Jusqu'à 100 propriétés sans ralentissement
- ✅ Recherche/filtrage performants

**Limite théorique** : Quota navigateur (~50% espace disque, soit plusieurs Go).

### Puis-je gérer des co-locations ?

**Oui**, complètement.

**Fonctionnalité** : Lors de la création d'un bail, sélectionnez **plusieurs locataires**.

**Exemple** :

- Appartement 4 pièces
- Locataires : Alice, Bob, Charlie (3 colocataires)
- Loyer total : 1500 € (réparti ou non, à votre gestion)

**Limitation actuelle** : Pas de répartition automatique du loyer par colocataire (feature future).

### Peut-on gérer plusieurs types de biens (appartements, commerces, parkings) ?

**Oui**, tous types de biens.

**Types disponibles** :

- 🏢 **Appartement**
- 🏠 **Maison**
- 🏪 **Commercial** (local, bureau)
- 🅿️ **Parking** (garage, box)
- 📦 **Autre** (cave, entrepôt, terrain)

Chaque type peut avoir des caractéristiques différentes (surface, pièces, etc.).

### Y a-t-il un système de rappels pour les loyers impayés ?

**Partiellement**.

**Actuellement** :

- ✅ Loyers en retard marqués en **rouge** 🔴
- ✅ Filtre "Loyers en retard"
- ✅ Dashboard affiche montant total en attente

**Pas encore** :

- ❌ Notifications push automatiques
- ❌ Emails de rappel

**Workaround** : Consultez régulièrement la page Loyers → Filtre "En retard".

**Roadmap** : Notifications optionnelles (future feature).

### Peut-on générer des quittances de loyer ?

**Pas encore** (feature en roadmap).

**Workaround actuel** :

1. Exporter vos données
2. Générer quittances manuellement (Word, Excel)

**Roadmap** : Génération PDF automatique de quittances (2026).

### Peut-on gérer les états des lieux ?

**Partiellement**.

**Actuellement** :

- ✅ Upload documents "État des lieux" (catégorie Documents)
- ✅ Lien document → Bail

**Pas encore** :

- ❌ Formulaire interactif état des lieux
- ❌ Comparaison entrée/sortie

**Workaround** : Uploadez vos états des lieux en PDF.

**Roadmap** : Module états des lieux complet (future feature).

### Peut-on suivre les dépenses (travaux, charges) ?

**Pas encore** (feature en roadmap).

**Workaround** :

- Uploadez factures en Documents (catégorie "Facture")
- Notes dans Description propriété

**Roadmap** : Module "Dépenses" avec suivi comptable (2026).

---

## Problèmes techniques

### L'icône d'installation n'apparaît pas

**Causes possibles** :

1. **Navigateur incompatible** → Utilisez Chrome ou Edge
2. **Déjà installé** → Vérifiez dans vos applications
3. **Critères PWA non remplis** → Vérifiez console développeur (F12)

**Solution** : Utilisez le menu d'installation alternatif (Chrome : Menu → "Installer Locapilot...").

Consultez [Guide Installation](./INSTALLATION.md#lico) pour détails.

### L'application ne fonctionne pas hors ligne

**Diagnostic** :

1. **Première ouverture ?** → Ouvrez l'app au moins 1x en ligne pour télécharger le cache
2. **Cache vidé ?** → Réinstallez l'application
3. **Service worker désactivé ?** → Vérifiez paramètres navigateur

**Vérification** :

- Chrome : `chrome://serviceworker-internals/`
- Edge : `edge://serviceworker-internals/`

**Solution** : Désinstallez et réinstallez (exportez données avant !).

### Mes données ont disparu

**Causes possibles** :

1. **Désinstallation** → Données supprimées automatiquement
2. **Cache navigateur vidé** → Données supprimées
3. **iOS inactivité >7j** → Safari peut supprimer données PWA
4. **Quota dépassé** → Navigateur a supprimé données (rare)

**Prévention** :

- ✅ Exportez régulièrement vos données (1x/semaine)
- ✅ Sauvegardez fichiers JSON dans cloud (Google Drive, Dropbox)
- ✅ (iOS) Ouvrez l'app au moins 1x/semaine

**Récupération** :

- Si vous avez une sauvegarde JSON → Importez-la
- Sinon → Données perdues 😢

### L'application est lente

**Causes possibles** :

1. **Beaucoup de documents** (>1000 fichiers lourds) → Archivez anciens docs
2. **Appareil faible** (ancien smartphone) → Utilisez version desktop
3. **Navigateur surchargé** (trop d'onglets) → Fermez onglets inutiles

**Solutions** :

- Supprimez documents non essentiels
- Videz cache navigateur (Paramètres navigateur → Effacer données)
- Utilisez appareil plus récent

### La mise à jour ne s'installe pas

**Solutions** :

1. **Fermez complètement** l'application (pas juste l'onglet)
2. **Rouvrez** → Mise à jour devrait se déclencher
3. Si échec : **Désinstallez** et **réinstallez** (exportez données avant !)

**Vérifier version** : Paramètres → À propos

### (iOS) Mes données sont supprimées après quelques jours

**Cause** : Limitation iOS - Safari supprime données PWA si inactivité >7 jours.

**Solutions** :

- ✅ Ouvrez l'app **au moins 1x/semaine**
- ✅ **Exportez données fréquemment** (1x/semaine)
- ✅ Utilisez **ordinateur ou Android** comme appareil principal

**Roadmap** : Synchronisation cloud optionnelle pour contourner limitation iOS.

---

## Contribution et développement

### Comment contribuer au projet ?

**Locapilot est open-source !**

**Façons de contribuer** :

1. **Signaler bugs** : [GitHub Issues](https://github.com/stalina/locapilot/issues)
2. **Suggérer fonctionnalités** : [GitHub Discussions](https://github.com/stalina/locapilot/discussions)
3. **Contribuer code** : [CONTRIBUTING.md](../CONTRIBUTING.md)
4. **Traduire** : Proposer traductions (EN, ES, etc.)
5. **Documenter** : Améliorer documentation
6. **Tester** : Beta-test nouvelles features

**Compétences utiles** :

- Vue 3 / TypeScript
- PWA / Service Workers
- IndexedDB / Dexie.js
- Tailwind CSS

### Quelles sont les prochaines fonctionnalités prévues ?

**Roadmap 2026** :

**Q1 2026** :

- ✅ Génération quittances loyer (PDF)
- ✅ Module dépenses/charges
- ✅ Tableaux de bord avancés (graphiques)

**Q2 2026** :

- ✅ États des lieux interactifs
- ✅ Notifications optionnelles (rappels loyers)
- ✅ Export Excel/CSV

**Q3 2026** :

- ✅ Synchronisation cloud optionnelle (Google Drive, Dropbox)
- ✅ Multi-utilisateurs (partage avec comptable)

**Q4 2026** :

- ✅ Mode multi-langues (EN, ES)
- ✅ Import depuis autres logiciels (CSV)

**Contribuez** : Votez pour vos features préférées sur [GitHub Discussions](https://github.com/stalina/locapilot/discussions).

### Puis-je héberger ma propre instance de Locapilot ?

**Oui**, complètement possible.

**Déploiement** :

1. **Fork** le repo GitHub
2. **Build** l'application (`npm run build`)
3. **Hébergez** le dossier `dist/` sur :
   - Netlify
   - Vercel
   - GitHub Pages
   - Votre propre serveur (Nginx, Apache)

**Avantages** :

- Contrôle total du code
- Personnalisation possible
- Domaine personnalisé

**Documentation** : [README.md - Déploiement](../README.md#déploiement)

### La synchronisation cloud sera-t-elle payante ?

**Non**, elle restera **gratuite et optionnelle**.

**Modèle prévu** (Q3 2026) :

- ✅ Gratuit : Utilisation locale (actuelle)
- ✅ Gratuit : Synchronisation Google Drive/Dropbox (votre compte)
- ✅ Gratuit : Auto-hébergement (votre serveur)

**Aucun abonnement** ne sera jamais requis. Locapilot reste open-source et gratuit.

### Comment le projet est-il financé ?

**Actuellement** : Projet personnel, contribution bénévole.

**Financement futur possible** :

- Dons GitHub Sponsors (optionnel)
- Hébergement instances cloud (optionnel, pour ceux qui ne veulent pas auto-héberger)

**Engagement** : Le projet restera toujours **open-source** et **auto-hébergeable gratuitement**.

---

## Questions non résolues ?

### Contactez-nous

- 📧 **Email** : support@locapilot.app
- 🐛 **Bug** : [GitHub Issues](https://github.com/stalina/locapilot/issues)
- 💬 **Discussion** : [GitHub Discussions](https://github.com/stalina/locapilot/discussions)
- 📖 **Documentation** :
  - [Guide d'installation](./INSTALLATION.md)
  - [Guide de démarrage](./GETTING_STARTED.md)
  - [Documentation développeur](../CONTRIBUTING.md)

---

**Dernière mise à jour** : 27 novembre 2025
