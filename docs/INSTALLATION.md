# Guide d'Installation - Locapilot PWA

Guide d'installation de l'application Locapilot sur vos appareils (ordinateur, tablette, smartphone).

---

## Qu'est-ce qu'une PWA ?

Locapilot est une **Progressive Web App (PWA)**, une application web moderne qui s'installe comme une application native sur votre appareil.

### Avantages

✅ **Fonctionne hors ligne** - Gérez vos propriétés même sans Internet  
✅ **Comme une app native** - Icône sur l'écran d'accueil, fenêtre dédiée  
✅ **Données privées** - Tout reste sur votre appareil  
✅ **Pas de téléchargement** - Installation directe depuis le navigateur  
✅ **Mises à jour automatiques** - Toujours à jour sans intervention

---

## Installation sur Ordinateur (Windows/Mac/Linux)

### Navigateurs compatibles

- ✅ **Google Chrome** (recommandé)
- ✅ **Microsoft Edge**
- ✅ **Brave**
- ⚠️ Firefox (support PWA limité)
- ⚠️ Safari macOS (support PWA partiel)

### Étapes d'installation

#### Google Chrome / Microsoft Edge

1. **Ouvrir Locapilot** dans votre navigateur  
   Rendez-vous sur l'URL de l'application (ex: `https://locapilot.netlify.app`)

2. **Icône d'installation**  
   Une icône d'installation ⊕ apparaît dans la barre d'adresse (à droite)

   ![Chrome install button](https://developer.chrome.com/static/docs/web-platform/progressive-web-apps/image/chrome-address-bar-with-39a9d8e3b8fbe_856.png)

3. **Cliquer sur "Installer"**  
   Un popup de confirmation s'affiche

4. **Confirmer l'installation**  
   Cliquez sur **"Installer"**

5. **L'application s'ouvre** 🎉  
   Locapilot s'ouvre dans une fenêtre dédiée, comme une application native

#### Méthode alternative (menu)

**Chrome**:

1. Cliquez sur les **3 points** en haut à droite
2. Allez dans **"Installer Locapilot..."**
3. Confirmez l'installation

**Edge**:

1. Cliquez sur les **3 points** en haut à droite
2. Allez dans **"Applications" → "Installer ce site en tant qu'application"**
3. Confirmez l'installation

### Accéder à l'application installée

**Windows**:

- Icône sur le **Bureau** (si option cochée lors de l'installation)
- Menu **Démarrer** → Recherchez "Locapilot"
- Raccourci dans la barre des tâches (épingler)

**macOS**:

- **Dossier Applications**
- **Dock** (faites glisser l'icône)
- **Spotlight** (Cmd + Espace → "Locapilot")

**Linux**:

- **Menu Applications**
- Lanceur d'applications (selon la distribution)

---

## Installation sur Android

### Navigateurs compatibles

- ✅ **Google Chrome** (recommandé)
- ✅ **Microsoft Edge**
- ✅ **Samsung Internet**
- ✅ **Brave**

### Étapes d'installation

#### Google Chrome (Android)

1. **Ouvrir Locapilot** dans Chrome  
   Rendez-vous sur l'URL de l'application

2. **Bannière d'installation**  
   Une bannière "Ajouter Locapilot à l'écran d'accueil" apparaît en bas

   ![Android install banner](https://web.dev/static/learn/pwa/installation/image/install-prompt-on-android-2aa5c0b48e7c1.png)

3. **Appuyer sur "Installer"**

4. **Confirmer**  
   Appuyez sur **"Ajouter"** dans le popup de confirmation

5. **Icône ajoutée** 🎉  
   L'icône Locapilot apparaît sur votre écran d'accueil

#### Méthode alternative (menu Chrome)

1. Ouvrir Locapilot dans Chrome
2. Appuyer sur les **3 points** en haut à droite
3. Sélectionner **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**
4. Confirmer

### Accéder à l'application

- Appuyez sur l'**icône Locapilot** sur votre écran d'accueil
- L'app s'ouvre en plein écran, comme une application native
- Pas de barre d'adresse, expérience immersive

---

## Installation sur iOS (iPhone/iPad)

### Navigateurs compatibles

- ✅ **Safari** uniquement (limitation iOS)
- ❌ Chrome/Edge iOS (redirigent vers Safari pour PWA)

### Étapes d'installation

#### Safari (iOS)

1. **Ouvrir Locapilot** dans Safari  
   Rendez-vous sur l'URL de l'application

2. **Bouton Partager**  
   Appuyez sur l'icône **Partager** en bas de l'écran (carré avec flèche vers le haut)

   ![iOS share button](https://support.apple.com/library/content/dam/edam/applecare/images/en_US/iOS/ios-14-safari-share-button.png)

3. **"Sur l'écran d'accueil"**  
   Faites défiler et appuyez sur **"Sur l'écran d'accueil"**

   ![Add to Home Screen](https://support.apple.com/library/content/dam/edam/applecare/images/en_US/iOS/ios-14-safari-add-to-home-screen.png)

4. **Personnaliser le nom** (optionnel)  
   Vous pouvez modifier le nom affiché (par défaut "Locapilot")

5. **Appuyer sur "Ajouter"**

6. **Icône ajoutée** 🎉  
   L'icône Locapilot apparaît sur votre écran d'accueil

### Accéder à l'application

- Appuyez sur l'**icône Locapilot** sur votre écran d'accueil
- L'app s'ouvre en plein écran (mode standalone)

### Limitations iOS

⚠️ **Stockage limité** : iOS peut supprimer les données si non utilisées pendant 7 jours  
⚠️ **Notifications** : Limitées comparé à Android  
⚠️ **Background sync** : Non supporté sur iOS

**Solution** : Ouvrez régulièrement l'application pour conserver vos données

---

## Installation sur Tablette

### iPad

Suivez les [instructions iOS](#installation-sur-ios-iphoneipad) ci-dessus (Safari).

### Tablette Android

Suivez les [instructions Android](#installation-sur-android) ci-dessus (Chrome).

### Tablette Windows

Suivez les [instructions Ordinateur](#installation-sur-ordinateur-windowsmaclinux) ci-dessus (Edge ou Chrome).

---

## Désinstallation

### Windows

**Méthode 1 (Paramètres)**:

1. **Paramètres Windows** → **Applications** → **Applications installées**
2. Cherchez **"Locapilot"**
3. Cliquez sur **"..."** → **"Désinstaller"**

**Méthode 2 (Chrome)**:

1. `chrome://apps/`
2. Clic droit sur **Locapilot** → **"Supprimer de Chrome..."**

### macOS

1. Ouvrez **Applications**
2. Glissez **Locapilot** vers la **Corbeille**
3. Videz la Corbeille

Ou depuis Chrome:

1. `chrome://apps/`
2. Clic droit sur **Locapilot** → **"Supprimer de Chrome..."**

### Linux

**Ubuntu/Debian**:

1. Clic droit sur l'icône → **"Désinstaller"**

Ou depuis Chrome:

1. `chrome://apps/`
2. Clic droit sur **Locapilot** → **"Supprimer de Chrome..."**

### Android

1. Appui long sur l'**icône Locapilot**
2. Glissez vers **"Désinstaller"** ou **"Infos de l'application" → "Désinstaller"**

### iOS

1. Appui long sur l'**icône Locapilot**
2. Appuyez sur **"Supprimer l'app"** ou **"Retirer de l'écran d'accueil"**

---

## Fonctionnement hors ligne

### Première utilisation

Lors de la **première ouverture**, l'application télécharge automatiquement tous les fichiers nécessaires pour fonctionner hors ligne.

**Indicateur** : Un message "Application prête hors ligne" apparaît.

### Mode hors ligne

Une fois installée, Locapilot fonctionne **entièrement hors ligne** :

✅ Consulter vos propriétés  
✅ Ajouter/modifier propriétés, locataires, baux  
✅ Enregistrer paiements de loyers  
✅ Uploader documents

**Toutes les données restent locales** sur votre appareil.

### Mises à jour de l'application

Lorsqu'une nouvelle version est disponible :

1. Un **message de mise à jour** apparaît dans l'application
2. Cliquez sur **"Mettre à jour"**
3. L'application se recharge avec la nouvelle version

**Les mises à jour sont automatiques** mais ne remplacent jamais vos données.

---

## Sauvegarde et restauration des données

### Export de données

Pour sauvegarder vos données :

1. **Paramètres** → **Données**
2. Cliquez sur **"Exporter les données"**
3. Un fichier `locapilot-backup-YYYY-MM-DD.json` est téléchargé

**Stockez ce fichier en lieu sûr** (cloud, clé USB, etc.)

### Import de données

Pour restaurer une sauvegarde :

1. **Paramètres** → **Données**
2. Cliquez sur **"Importer les données"**
3. Sélectionnez votre fichier de sauvegarde `.json`
4. Confirmez l'import

⚠️ **Attention** : L'import **remplace toutes les données actuelles**.

### Synchronisation multi-appareils

**Locapilot ne synchronise pas automatiquement** entre appareils.

Pour utiliser vos données sur un autre appareil :

1. **Exportez** les données depuis l'appareil source
2. Transférez le fichier `.json` vers l'autre appareil (email, cloud, etc.)
3. **Importez** les données sur l'appareil cible

---

## Dépannage

### L'icône d'installation n'apparaît pas

**Causes possibles** :

1. **Navigateur incompatible** → Utilisez Chrome ou Edge
2. **Déjà installé** → Vérifiez dans vos applications
3. **Connexion HTTPS requise** → L'app doit être servie en HTTPS
4. **Critères PWA non remplis** → Vérifiez la console développeur

**Solution** : Essayez le [menu d'installation alternatif](#méthode-alternative-menu)

### L'application ne fonctionne pas hors ligne

1. **Première ouverture nécessaire** : Ouvrez l'app au moins une fois en ligne
2. **Cache vidé** : Réinstallez l'application
3. **Service worker désactivé** : Vérifiez les paramètres du navigateur

### Données perdues après désinstallation

⚠️ **La désinstallation supprime toutes les données locales**.

**Préventions** :

- Exportez régulièrement vos données (**Paramètres → Exporter**)
- Conservez plusieurs sauvegardes (cloud, local, email)

### L'application ne se met pas à jour

1. **Fermez complètement** l'application
2. **Rouvrez-la** → La mise à jour devrait se déclencher
3. Si le problème persiste : **Désinstallez et réinstallez**

**Vos données** : Exportez-les avant de réinstaller !

### Sur iOS, mes données disparaissent

**Limitation iOS** : Safari peut supprimer les données PWA si non utilisées pendant 7+ jours.

**Solutions** :

1. **Ouvrez l'app régulièrement** (au moins 1x/semaine)
2. **Exportez vos données fréquemment**
3. Considérez utiliser un appareil Android ou ordinateur comme source principale

---

## Compatibilité des navigateurs

| Navigateur           | Windows     | macOS       | Linux       | Android    | iOS         |
| -------------------- | ----------- | ----------- | ----------- | ---------- | ----------- |
| **Chrome**           | ✅ Complet  | ✅ Complet  | ✅ Complet  | ✅ Complet | ⚠️ Limité¹  |
| **Edge**             | ✅ Complet  | ✅ Complet  | ✅ Complet  | ✅ Complet | ⚠️ Limité¹  |
| **Safari**           | ❌ N/A      | ⚠️ Partiel  | ❌ N/A      | ❌ N/A     | ✅ Complet² |
| **Firefox**          | ⚠️ Basique³ | ⚠️ Basique³ | ⚠️ Basique³ | ❌ Limité  | ❌ Non      |
| **Brave**            | ✅ Complet  | ✅ Complet  | ✅ Complet  | ✅ Complet | ⚠️ Limité¹  |
| **Samsung Internet** | ❌ N/A      | ❌ N/A      | ❌ N/A      | ✅ Complet | ❌ N/A      |

**Légende** :

- ✅ **Complet** : Installation PWA complète, pleine fonctionnalité
- ⚠️ **Partiel/Limité** : Fonctionne mais limitations (voir notes)
- ❌ **Non** : Pas de support PWA

**Notes** :

1. Chrome/Edge/Brave iOS redirigent vers Safari pour installation PWA
2. Safari iOS : Stockage limité, peut supprimer données après 7j inactivité
3. Firefox desktop : Support PWA minimal, pas d'installation native recommandée

**Recommandation** :

- **Desktop** : Chrome ou Edge
- **Android** : Chrome
- **iOS** : Safari (seul choix)

---

## FAQ Installation

### Est-ce que Locapilot prend de la place sur mon appareil ?

**Oui**, comme toute application. Environ **2-5 MB** pour l'app + vos données.

Les documents uploadés (photos, PDF) peuvent augmenter cette taille.

### Faut-il une connexion Internet pour utiliser Locapilot ?

**Non** après installation. L'application fonctionne **100% hors ligne**.

Une connexion est nécessaire uniquement pour :

- La première installation
- Les mises à jour de l'application (optionnel)

### Mes données sont-elles synchronisées dans le cloud ?

**Non**. Toutes vos données restent **locales** sur votre appareil.

**Avantages** :

- ✅ Confidentialité totale
- ✅ Pas de frais cloud
- ✅ Fonctionne hors ligne

**Inconvénient** :

- ⚠️ Pas de sync automatique multi-appareils

**Solution** : Export/Import manuel via fichier JSON

### Puis-je utiliser Locapilot sur plusieurs appareils ?

**Oui**, mais sans synchronisation automatique.

**Workflow recommandé** :

1. Utilisez un **appareil principal** (ordinateur ou tablette)
2. Exportez régulièrement vos données
3. Importez sur d'autres appareils si besoin

### L'application va-t-elle ralentir avec beaucoup de données ?

**Non**. Locapilot utilise **IndexedDB**, une base de données performante.

Vous pouvez gérer **des centaines de propriétés, locataires, baux** sans ralentissement.

**Limite** : Quota du navigateur (~50% espace disque disponible)

### Comment savoir quelle version j'utilise ?

**Paramètres** → **À propos** → Version affichée

Ou vérifiez la console développeur :

```javascript
console.log(localStorage.getItem('locapilot-version'));
```

### Dois-je accepter les notifications ?

**Optionnel**. Les notifications servent uniquement pour :

- Rappels de loyers à payer (future feature)
- Alertations de mise à jour de l'app

**Vous pouvez refuser** sans impact sur les fonctionnalités actuelles.

---

## Support

### Besoin d'aide ?

- 📧 **Email** : support@locapilot.app (à configurer)
- 🐛 **Bug report** : [GitHub Issues](https://github.com/stalina/locapilot/issues)
- 📖 **Documentation** : [Guide utilisateur](./GETTING_STARTED.md)

### Contribuer

Locapilot est open-source ! Consultez [CONTRIBUTING.md](../CONTRIBUTING.md) pour contribuer.

---

**Dernière mise à jour** : 27 novembre 2025
