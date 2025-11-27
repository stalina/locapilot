# Déploiement Locapilot

Ce document décrit les options de déploiement pour l'application Locapilot.

## Options de Déploiement

### Option 1: GitHub Pages (Configuré par défaut)

**Avantages**:

- ✅ Gratuit
- ✅ Intégré à GitHub
- ✅ Déjà configuré dans `.github/workflows/deploy.yml`
- ✅ Déploiement automatique sur push vers `main`

**Configuration**:

1. Activer GitHub Pages dans les paramètres du repository
2. Source: GitHub Actions
3. L'application sera disponible sur `https://stalina.github.io/locapilot/`

**Limitations**:

- ❌ Nécessite un base path `/locapilot/` (déjà configuré dans `vite.config.ts`)
- ❌ Pas de preview deploys automatiques pour les PRs

### Option 2: Netlify (Recommandé pour preview deploys)

**Avantages**:

- ✅ Gratuit pour projets personnels
- ✅ Preview deploys automatiques pour chaque PR
- ✅ Headers HTTP personnalisés (sécurité, cache)
- ✅ Redirects SPA natifs
- ✅ Pas de base path nécessaire

**Configuration**:

1. **Créer un compte Netlify** (si pas déjà fait):
   - Aller sur [netlify.com](https://www.netlify.com)
   - Se connecter avec GitHub

2. **Ajouter les secrets GitHub**:

   ```bash
   # Récupérer le token Netlify: Settings → User settings → Applications → Personal access tokens
   gh secret set NETLIFY_AUTH_TOKEN

   # Récupérer le site ID: Site settings → General → Site details → API ID
   gh secret set NETLIFY_SITE_ID
   ```

3. **Activer le workflow Netlify**:
   - Le fichier `.github/workflows/netlify-deploy.yml` est déjà configuré
   - Il se déclenche automatiquement sur push vers `main` et sur les PRs
   - Chaque PR aura une URL de preview unique

4. **Configuration Netlify locale**:
   - Le fichier `netlify.toml` est déjà configuré
   - Headers de sécurité optimisés
   - Cache configuré pour PWA

**Commande de déploiement manuel**:

```bash
# Installer Netlify CLI (optionnel)
npm install -g netlify-cli

# Login
netlify login

# Déployer
npm run build
netlify deploy --prod --dir=dist
```

### Option 3: Vercel

**Avantages**:

- ✅ Gratuit pour projets personnels
- ✅ Preview deploys automatiques
- ✅ Performance optimale

**Configuration**:

```bash
# Installer Vercel CLI
npm install -g vercel

# Login
vercel login

# Déployer
vercel --prod
```

Fichier `vercel.json` (à créer si besoin):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

## Déploiement Local pour Tests

```bash
# Build production
npm run build

# Preview local
npm run preview
# ou
npx serve dist -s
```

## Configuration PWA

L'application est configurée pour fonctionner comme PWA:

- **Service Worker**: Généré automatiquement par `vite-plugin-pwa`
- **Manifest**: Configuré dans `vite.config.ts`
- **Offline**: Stratégie cache-first pour les assets
- **Mise à jour**: Auto-update activé

### Test PWA Local

```bash
# Build production
npm run build

# Servir avec HTTPS (requis pour PWA)
npx serve dist -s --ssl-cert localhost.pem --ssl-key localhost-key.pem
# ou utiliser http-server
npx http-server dist -g -c-1 -p 8080
```

### Validation PWA

Après déploiement, vérifier:

1. Chrome DevTools → Application → Manifest
2. Chrome DevTools → Application → Service Workers
3. Lighthouse audit (score PWA > 90)

## Scripts Disponibles

```json
{
  "build": "vite build",
  "preview": "vite preview",
  "deploy:gh": "git push origin main",
  "deploy:netlify": "netlify deploy --prod --dir=dist"
}
```

## Troubleshooting

### GitHub Pages: Base Path Issues

Si les routes ne fonctionnent pas sur GitHub Pages:

- Vérifier que `base: '/locapilot/'` est configuré dans `vite.config.ts`
- Vérifier que `scope` et `start_url` dans le manifest utilisent le même base path

### Netlify: Preview Not Working

Si les preview deploys ne se créent pas:

- Vérifier que les secrets `NETLIFY_AUTH_TOKEN` et `NETLIFY_SITE_ID` sont configurés
- Vérifier les logs dans Actions → Workflow runs

### Service Worker Not Updating

Si le service worker ne se met pas à jour:

- Force refresh: Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)
- DevTools → Application → Service Workers → Unregister
- Clear browser cache

## Monitoring

### GitHub Pages

- Status: https://www.githubstatus.com
- Logs: Repository → Actions

### Netlify

- Dashboard: https://app.netlify.com
- Deploy logs: Site → Deploys → Deploy log
- Analytics: Site → Analytics

## Recommandations

Pour ce projet, je recommande:

1. **Production**: GitHub Pages (gratuit, simple, déjà configuré)
2. **Preview PRs**: Netlify (meilleure expérience pour reviewer les PRs)
3. **Développement**: Les deux workflows peuvent coexister

Les deux workflows sont configurés et prêts à l'emploi.
