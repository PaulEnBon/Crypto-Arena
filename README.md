# Crypto Arena

> Jeu de simulation de trading de cryptomonnaies : argent 100 % virtuel, prix réels fournis par CoinGecko, classement entre joueurs.
> Projet universitaire (Bachelor 2) — React + TypeScript + FastAPI + PostgreSQL.

Documentation complémentaire : [API](docs/API.md) · [Scénario de démonstration](docs/DEMO.md) · [Fiche de soutenance](docs/SOUTENANCE.md) · [Base de données](database/README.md)

---

## Sommaire

- [Crypto Arena](#crypto-arena)
  - [Sommaire](#sommaire)
  - [1. Problématique et objectif](#1-problématique-et-objectif)
  - [2. Fonctionnalités](#2-fonctionnalités)
  - [3. Architecture](#3-architecture)
  - [4. Technologies](#4-technologies)
  - [5. Prérequis](#5-prérequis)
  - [6. Installation du backend](#6-installation-du-backend)
  - [7. Configuration PostgreSQL](#7-configuration-postgresql)
  - [8. Variables d'environnement](#8-variables-denvironnement)
  - [9. Configuration CoinGecko](#9-configuration-coingecko)
  - [10. Installation du frontend](#10-installation-du-frontend)
  - [11. Lancement du projet](#11-lancement-du-projet)
  - [12. Données de démonstration](#12-données-de-démonstration)
  - [13. Tests](#13-tests)
  - [14. Build de production](#14-build-de-production)
  - [15. Déploiement](#15-déploiement)
  - [16. Structure du projet](#16-structure-du-projet)
  - [17. API](#17-api)
  - [18. Sécurité](#18-sécurité)
  - [19. Choix techniques](#19-choix-techniques)
  - [20. Performance](#20-performance)
  - [21. Limites du projet](#21-limites-du-projet)
  - [22. Améliorations possibles](#22-améliorations-possibles)
  - [23. Répartition du travail](#23-répartition-du-travail)

---

## 1. Problématique et objectif

**Problématique.** Comment permettre à des débutants de s'entraîner au trading de cryptomonnaies, avec de vraies conditions de marché, sans risquer d'argent réel — tout en garantissant que les règles du jeu (soldes, quantités, prix) ne puissent pas être contournées depuis le navigateur ?

**Objectif.** Construire une application web complète où chaque joueur reçoit 10 000 € virtuels, achète et vend des cryptomonnaies aux prix réels de CoinGecko, suit la performance de son portefeuille et se compare aux autres joueurs dans un classement global. Le serveur est la seule source de vérité : il fixe les prix, valide chaque opération et calcule le classement.

## 2. Fonctionnalités

| Domaine          | Fonctionnalités                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentification | Inscription (username, email, mot de passe + confirmation), connexion, JWT, déconnexion, routes privées protégées, session restaurée au rechargement, gestion du jeton expiré |
| Dashboard        | Valeur totale, cash disponible, investissement total, profit/perte, performance %, graphique d'évolution (30 j), position au classement, cryptos tendances, top cryptos, dernières transactions |
| Marché           | Liste CoinGecko (rang, nom, symbole, prix, variation 24 h, market cap, volume, sparkline 7 j), recherche locale + recherche CoinGecko (débouncée), tri par colonne, filtre hausse/baisse, pagination, taille de page |
| Détail crypto    | Route `/crypto/:coinId` : logo, prix, variations 24 h/7 j/30 j, graphique historique (1 j → 1 an), statistiques (market cap, volume, ATH, offre…), description, formulaire achat/vente avec confirmation |
| Trading          | Achat/vente au prix courant déterminé **côté serveur**, validation client + serveur (quantité, solde, quantité détenue, montant minimum), raccourcis 25 % / 50 % / Max |
| Portefeuille     | Cash, valeur totale, P&L, performance, positions valorisées en direct (prix moyen, P&L par actif, allocation), graphique de répartition, historique paginé |
| Classement       | Classement global calculé côté serveur (`performance %`), podium, joueur connecté surligné, pagination, position personnelle                    |
| Profil           | Username (modifiable), email, date d'inscription, capital initial/actuel, performance, nombre de transactions, rang                             |
| Robustesse       | États loading / empty / error / success partout, bouton « Réessayer », toasts, page 404, mode dégradé si CoinGecko est indisponible            |
| UX               | Thème sombre « arena », responsive (desktop en priorité, mobile utilisable), accessibilité de base (labels, rôles ARIA, navigation clavier)      |

## 3. Architecture

```
┌──────────────────────┐   HTTPS / JSON    ┌──────────────────────┐   httpx + cache   ┌───────────────┐
│  Frontend React/TS   │ ────────────────▶ │  Backend FastAPI     │ ────────────────▶ │  CoinGecko    │
│  Vite · Router · CTX │ ◀──────────────── │  JWT · Pydantic ·    │ ◀──────────────── │  API v3       │
│  (Vercel / Netlify)  │   Bearer JWT      │  SQLAlchemy async    │                   └───────────────┘
└──────────────────────┘                   └──────────┬───────────┘
                                                      │ psycopg (async)
                                                      ▼
                                           ┌──────────────────────┐
                                           │  PostgreSQL          │
                                           │  users · portfolios  │
                                           │  assets · holdings   │
                                           │  transactions ·      │
                                           │  portfolio_snapshots │
                                           └──────────────────────┘
```

Principes :

- **Le frontend ne parle qu'au backend.** La clé CoinGecko n'existe que dans `backend/.env` et n'apparaît jamais dans le bundle JavaScript.
- **Le backend fixe les prix.** Un ordre d'achat contient `{ coin_id, quantity }` ; le prix est lu par le serveur au moment de l'exécution.
- **Le classement est calculé côté serveur** à partir des prix courants, puis paginé.
- **Cache et protection du quota CoinGecko** dans le backend (TTL, single-flight, retries, réponse de secours).

Frontend : `components/`, `pages/`, `hooks/`, `context/`, `services/`, `types/`, `layouts/`, `utils/`, `tests/`.
Backend : `main.py`, `models/`, `schemas/`, `routers/`, `services/`, `database/`, `auth/`, `middleware/`.

## 4. Technologies

| Côté      | Technologies                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend  | React 19, TypeScript 5.9 (strict), Vite 7, React Router 7 (API v6 : `Routes`/`Outlet`/`useNavigate`), Context API + `useReducer`, Fetch API + `AbortController`, Tailwind CSS 4, Recharts 3, Vitest 3 + React Testing Library, ESLint 9 |
| Backend   | Python 3.12+, FastAPI, Pydantic v2 + pydantic-settings, SQLAlchemy 2.0 (async, psycopg 3), PostgreSQL, PyJWT (JWT HS256), bcrypt, httpx, uvicorn, pytest + pytest-asyncio |
| API externe | [CoinGecko API v3](https://docs.coingecko.com/) (plan Demo)                                                                          |
| Déploiement | Vercel (frontend), Render instance gratuite (backend), Neon (PostgreSQL gratuit) ; alternatives : Netlify, Railway, Docker                |

## 5. Prérequis

- Node.js ≥ 20 et npm
- Python ≥ 3.12
- PostgreSQL ≥ 14 (installé localement, ou via `docker compose up -d`)
- Une clé API CoinGecko (plan Demo gratuit) — voir [§9](#9-configuration-coingecko)

## 6. Installation du backend

```bash
cd backend
python -m venv .venv
# Windows : .venv\Scripts\activate    |    macOS/Linux : source .venv/bin/activate
pip install -r requirements-dev.txt     # requirements.txt suffit en production
cp .env.example .env                    # Windows PowerShell : Copy-Item .env.example .env
```

Puis renseignez `backend/.env` (voir [§8](#8-variables-denvironnement)).

## 7. Configuration PostgreSQL

**Option A — PostgreSQL installé localement**

```bash
createdb -U postgres crypto_arena
```

(ou dans psql : `CREATE DATABASE crypto_arena;`). Dans `backend/.env` :

```
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/crypto_arena
```

**Option B — Docker**

```bash
docker compose up -d
```

```
DATABASE_URL=postgresql://crypto:crypto@localhost:5432/crypto_arena
```

**Création des tables** (idempotente, aussi exécutée automatiquement au démarrage du backend avec `AUTO_INIT_DB=true`) :

```bash
cd backend
python -m app.database.init_db
```

Le schéma de référence est documenté dans [`database/schema.sql`](database/schema.sql) et [`database/README.md`](database/README.md).

## 8. Variables d'environnement

Backend — `backend/.env` (modèle : [`backend/.env.example`](backend/.env.example)) :

| Variable                        | Obligatoire | Rôle                                                                                   |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | oui         | Connexion PostgreSQL (`postgresql://user:password@host:5432/db`, `postgres://` accepté) |
| `JWT_SECRET`                    | oui         | Secret de signature des JWT (≥ 16 caractères ; `python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `COINGECKO_API_KEY`             | recommandé  | Clé CoinGecko plan Demo (sans clé : accès public, limites plus basses)                 |
| `APP_ENV`                       | non         | `development` (défaut) / `test` / `production`                                          |
| `AUTO_INIT_DB`                  | non         | Crée les tables et le catalogue au démarrage (défaut `true`)                            |
| `ACCESS_TOKEN_EXPIRE_MINUTES`   | non         | Durée de vie du JWT (défaut 480)                                                        |
| `CORS_ORIGINS`                  | non         | Origines autorisées, séparées par des virgules (défaut `http://localhost:5173,http://127.0.0.1:5173`) |
| `COINGECKO_CACHE_TTL_*`         | non         | Durées de cache en secondes (marchés 60, prix 30, détail 120, historique 300, recherche 600, tendances 300) |
| `COINGECKO_TIMEOUT_SECONDS`, `COINGECKO_MAX_RETRIES` | non | Timeout (10 s) et nombre de nouvelles tentatives (2)                        |
| `INITIAL_BALANCE`               | non         | Capital de départ (défaut 10000)                                                        |
| `SNAPSHOT_INTERVAL_MINUTES`, `LEADERBOARD_CACHE_TTL` | non | Fréquence des snapshots (60 min) et cache du classement (30 s)                |

Frontend — `frontend/.env` (modèle : [`frontend/.env.example`](frontend/.env.example)) :

| Variable        | Rôle                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `VITE_API_URL`  | URL du backend **sans** `/api` ni slash final (`http://localhost:8000`) |

Seules les variables préfixées `VITE_` sont exposées au navigateur : aucun secret ne doit y figurer. Les fichiers `.env` sont ignorés par git.

## 9. Configuration CoinGecko

**Pourquoi CoinGecko ?** API gratuite, bien documentée, couvrant des milliers de cryptomonnaies avec prix, capitalisation, volume, historique et recherche — parfaite pour valoriser des portefeuilles en euros.

1. Créer un compte sur <https://www.coingecko.com/en/developers/dashboard> et générer une clé **Demo** (gratuite).
2. La placer dans `backend/.env` : `COINGECKO_API_KEY=CG-xxxxxxxx`.
3. Le backend l'envoie dans l'en-tête `x-cg-demo-api-key` (méthode officielle du plan Demo). Base URL : `https://api.coingecko.com/api/v3`.

**Proxy backend.** Toutes les routes `/api/crypto/*` sont servies par `CoinGeckoService` (`backend/app/services/coingecko_service.py`), seul composant qui communique avec CoinGecko.

**Endpoints CoinGecko utilisés** : `/coins/markets` (liste, sparkline), `/simple/price` (prix pour les trades, le portefeuille et le classement), `/coins/{id}` (détail), `/coins/{id}/market_chart` (historique), `/search` (recherche), `/search/trending` (tendances), `/ping` (santé).

**Gestion des limites et des erreurs** : cache TTL par endpoint et par coin, requêtes identiques fusionnées (single-flight), concurrence bornée, timeout 10 s, 2 tentatives avec back-off et respect de `Retry-After`, réponse périmée servie en secours si CoinGecko échoue, erreurs mappées en 404 / 429 / 502 / 503 avec un message lisible. `GET /api/health/coingecko` renvoie `200` (disponible), `429` (limite atteinte), `500` (erreur CoinGecko) ou `503` (indisponible), plus les statistiques du cache.

## 10. Installation du frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
```

## 11. Lancement du projet

Terminal 1 — backend (http://localhost:8000, Swagger sur `/docs`) :

```bash
cd backend
python run.py
```

> `python run.py` équivaut à `uvicorn app.main:app --reload`. Sur **Windows**, il sélectionne automatiquement une boucle d'événements compatible avec psycopg async (`--loop app.runtime:selector_event_loop`) ; utilisez-le de préférence à `uvicorn` directement.

Terminal 2 — frontend (http://localhost:5173) :

```bash
cd frontend
npm run dev
```

Vérifications : http://localhost:8000/api/health (API + PostgreSQL) et http://localhost:8000/api/health/coingecko (CoinGecko).

## 12. Données de démonstration

```bash
cd backend
python -m app.database.seed            # crée les comptes de démo manquants
python -m app.database.seed --reset    # supprime puis recrée uniquement les comptes is_demo = true
```

- Compte principal : **demo@cryptoarena.dev** / **Demo123!** (bouton « Pré-remplir » sur la page de connexion).
- 9 autres joueurs fictifs (CryptoMaster, TraderX, MoonBoy…) avec des transactions passées et 30 jours de snapshots, pour un classement et des graphiques non vides.
- Séparation production/démo : les comptes portent le flag `is_demo`, utilisent des emails `@cryptoarena.dev`, et le script refuse de s'exécuter avec `APP_ENV=production` (sauf `--force`).

## 13. Tests

Frontend (Vitest + Testing Library, environnement jsdom) :

```bash
cd frontend
npm run test
```

24 tests dans `src/tests/` : `LoginForm` (validation, soumission), `TransactionForm` (validation conditionnelle achat/vente, confirmation), `MarketsPage` (affichage du loading, affichage d'une erreur API + « Réessayer »), `useAsync` (états, race condition, annulation), `appReducer` (immutabilité), `validation`.

Backend (pytest, SQLite en mémoire + faux service CoinGecko : aucun réseau requis) :

```bash
cd backend
python -m pytest
```

41 tests : authentification/JWT, moteur de trading et erreurs métier, valorisation, snapshots, classement, profil, service CoinGecko (cache, réponse périmée, 429, 404, erreur réseau).

Qualité :

```bash
cd frontend
npm run typecheck   # tsc --noEmit (0 erreur)
npm run lint        # ESLint (interdit `any`)
```

## 14. Build de production

```bash
cd frontend
npm run build       # tsc -b && vite build -> dist/
npm run preview     # prévisualisation du build
```

Le bundle Recharts est séparé (`manualChunks`) pour un meilleur cache navigateur.

## 15. Déploiement

Architecture de production, entièrement gratuite :

| Composant | Hébergeur | Offre |
| --------- | --------- | ----- |
| Frontend React | Vercel | Hobby, gratuit |
| Backend FastAPI | Render | instance `free`, mise en veille après 15 min sans trafic |
| PostgreSQL | Neon | gratuit sans expiration, 0,5 Go, mise à l'échelle à zéro |

**Base de données (Neon)** : projet `Crypto Arena`, branche `production`, région `aws-eu-central-1` (Francfort). Utiliser l'URL **directe** (hôte sans `-pooler`) : le backend est un serveur long qui gère son propre pool SQLAlchemy (`pool_pre_ping` reconnecte après la mise en veille de Neon) et crée le schéma au démarrage, ce que Neon recommande de faire hors PgBouncer. Initialisation et données de démo depuis un poste local, avec cette URL dans `backend/.env` :

```bash
python -m app.database.init_db
python -m app.database.seed
```

Les bases PostgreSQL gratuites de **Render** ne sont pas utilisées car elles expirent 30 jours après leur création.

**Backend (Render)** : le blueprint [`render.yaml`](render.yaml) crée uniquement le service web, avec `plan: free` (sans ce champ, Render choisit une instance payante) et `region: frankfurt` pour être au plus près de Neon. Variables demandées à la création : `DATABASE_URL` (URL Neon directe) et `COINGECKO_API_KEY`. `JWT_SECRET` est générée automatiquement ; `CORS_ORIGINS` est à mettre à jour avec l'URL Vercel. Alternative Docker (Railway, Fly.io…) : [`backend/Dockerfile`](backend/Dockerfile), commande `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Les tables sont créées au démarrage si elles n'existent pas (`AUTO_INIT_DB=true`, idempotent).

**Frontend (Vercel ou Netlify)** : racine `frontend/`, build `npm run build`, dossier `dist`. Variable `VITE_API_URL=https://votre-backend.onrender.com`. Les réécritures SPA sont fournies (`vercel.json`, `netlify.toml`, `public/_redirects`) pour que `/crypto/bitcoin` serve `index.html`.

**CORS** : `CORS_ORIGINS` doit contenir exactement l'origine du frontend (`https://crypto-arena.vercel.app`), sans slash final. `allow_origins=["*"]` n'est jamais utilisé.

**HTTPS** : fourni nativement par Vercel/Netlify/Render.

## 16. Structure du projet

```
Crypto-Arena/
├── README.md · docker-compose.yml · render.yaml
├── docs/            API.md · DEMO.md · SOUTENANCE.md
├── database/        schema.sql · README.md
├── backend/
│   ├── run.py                       lanceur dev (uvicorn + boucle compatible Windows)
│   ├── requirements.txt · requirements-dev.txt · pyproject.toml · Dockerfile · .env.example
│   ├── app/
│   │   ├── main.py                  application FastAPI, lifespan, CORS, routers
│   │   ├── config.py                Settings typés (pydantic-settings, .env)
│   │   ├── exceptions.py            exceptions métier → codes HTTP
│   │   ├── runtime.py               boucle d'événements (Windows)
│   │   ├── auth/                    security.py (bcrypt, JWT) · dependencies.py (get_current_user)
│   │   ├── database/                base.py · session.py · init_db.py · seed.py
│   │   ├── middleware/              error_handlers.py · request_context.py
│   │   ├── models/                  user · portfolio · asset · holding · transaction · snapshot
│   │   ├── routers/                 auth · crypto · portfolio · trades · leaderboard · profile · health
│   │   ├── schemas/                 auth · user · crypto · portfolio · trade · leaderboard · health · common (Paginated[T])
│   │   └── services/                coingecko_service · cache · auth · asset · portfolio · trade · leaderboard
│   └── tests/                       conftest (SQLite + FakeCoinGecko) · test_auth · test_trades · test_portfolio_leaderboard · test_coingecko_service
└── frontend/
    ├── index.html · vite.config.ts · tsconfig*.json · eslint.config.js · vercel.json · netlify.toml · .env.example
    ├── public/                      favicon.svg · _redirects
    └── src/
        ├── main.tsx · App.tsx (routes) · index.css (thème Tailwind)
        ├── components/
        │   ├── ui/                  Button · Card · Modal · Badge · FormField · LoadingSpinner · ErrorMessage · EmptyState · Pagination · StatCard · Sparkline · SearchInput · PriceChange · CoinAvatar · Skeleton · PageHeader · icons
        │   ├── layout/              Navbar · Sidebar · Logo · ToastContainer · ProtectedRoute
        │   ├── auth/                LoginForm · RegisterForm
        │   ├── crypto/              CryptoTable · CryptoCard · PriceChart · TrendingList · CoinSearchResults
        │   ├── portfolio/           PortfolioSummary · HoldingsTable · TransactionHistory · AllocationChart · PerformanceChart
        │   ├── trade/               TransactionForm
        │   └── leaderboard/         LeaderboardTable
        ├── context/                 appReducer · AppContext · AppProvider · ToastContext · ToastProvider
        ├── hooks/                   useAsync · useAuth · usePortfolio · useCoinGecko · useDebounce · useLeaderboard
        ├── layouts/                 AppLayout · AuthLayout
        ├── pages/                   Landing · Login · Register · Dashboard · Markets · CryptoDetail · Portfolio · Leaderboard · Profile · NotFound
        ├── services/                apiClient · authService · cryptoService · portfolioService · tradeService · leaderboardService · profileService
        ├── types/                   api · user · crypto · portfolio · leaderboard
        ├── utils/                   format · validation · storage · profiler
        └── tests/                   setup + 6 fichiers de tests
```

## 17. API

Résumé des endpoints (détails, exemples et codes d'erreur dans [docs/API.md](docs/API.md) ; Swagger sur `/docs`) :

```
POST  /api/auth/register            POST  /api/auth/login             GET  /api/auth/me
GET   /api/crypto/markets           GET   /api/crypto/trending        GET  /api/crypto/search?q=
GET   /api/crypto/prices?ids=       GET   /api/crypto/{coin_id}       GET  /api/crypto/{coin_id}/history?days=
GET   /api/portfolio                GET   /api/portfolio/transactions GET  /api/portfolio/snapshots
POST  /api/trades/buy               POST  /api/trades/sell
GET   /api/leaderboard              GET   /api/leaderboard/me
GET   /api/profile                  PATCH /api/profile
GET   /api/health                   GET   /api/health/coingecko
```

Toutes les erreurs ont la forme `{ "detail": "message lisible", "code": "CODE_MACHINE" }`.

## 18. Sécurité

- Mots de passe hachés avec **bcrypt** (jamais en clair), comparaison à temps constant, aucun indice sur l'existence d'un email à la connexion.
- **JWT** signé (HS256) avec `JWT_SECRET` hors dépôt, expiration, vérification sur chaque route privée.
- Clé CoinGecko et secrets uniquement dans `backend/.env` (ignoré par git) ; `.env.example` sans valeurs.
- Validation systématique côté serveur (Pydantic : types, bornes, regex ; règles métier : solde, quantité, montant minimum). Le prix n'est jamais accepté du client.
- Requêtes SQL paramétrées via SQLAlchemy (pas d'injection), contraintes `CHECK`/`UNIQUE`/clés étrangères, transactions + verrous ligne pour les opérations financières.
- CORS restreint à `CORS_ORIGINS` (jamais `*` en production), méthodes et en-têtes explicites.
- Comptes de démonstration isolés par `is_demo` ; le seed refuse de tourner en production.

## 19. Choix techniques

- **FastAPI async + SQLAlchemy async** : un backend I/O-bound (PostgreSQL + CoinGecko) profite pleinement de l'asynchrone ; Pydantic produit la documentation OpenAPI gratuitement.
- **Table `holdings` + méthode du coût moyen** : positions lues sans agrégation, prix moyen d'achat cohérent pour le P&L par actif, ligne à verrouiller pendant un trade.
- **Prix résolu côté serveur, arrondi au centime, montant minimum 0,01 €** : impossible de tricher ou d'exploiter les arrondis.
- **Context API + `useReducer`** : périmètre d'état global limité (session, portefeuille, notifications) ; un reducer typé rend les transitions atomiques et testables sans dépendance externe.
- **Hook générique `useAsync<T>`** : un seul endroit pour les états loading/success/error, l'annulation (`AbortController`) et la protection contre les race conditions ; les hooks métier (`useMarkets`, `useCoin`…) le composent.
- **Tailwind CSS 4** avec des tokens de design (`@theme`) et quelques classes composées (`card`, `input`, `nav-link`) : identité visuelle propre, cohérente, sans framework de composants.
- **Recharts** pour les graphiques riches (historique, performance, répartition) et un `Sparkline` SVG maison pour les 50-100 mini-courbes du marché (bien plus léger).
- **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`…) et interdiction de `any` par ESLint ; génériques maison `Paginated<T>`, `ApiResponse<T>`, `useAsync<T>`, `request<T>`.
- **Tests sans réseau** : faux service CoinGecko et SQLite en mémoire côté backend, mocks de services côté frontend → suites rapides et déterministes.

## 20. Performance

Démarche : **mesurer avant d'optimiser**. `MarketsPage` enveloppe le tableau dans `<Profiler>` (dev uniquement) et journalise chaque rendu : `[Profiler] CryptoTable update: 3.8 ms (sans memo ≈ 64 ms)` lors de la saisie dans la recherche. Optimisations retenues, chacune justifiée dans le code :

- `memo(CryptoRow)` + `useCallback(onSelect)` : 50-100 lignes avec sparkline re-rendues à chaque frappe sinon.
- `memo(Sparkline)` : chemin SVG de 168 points recalculé inutilement sinon.
- `useMemo` : filtrage/tri du marché, transformation des séries pour Recharts, valeur des contextes (fonctions stables utilisées comme dépendances d'effets).
- Pas de `memo` sur le classement ni l'historique : ils ne se re-rendent qu'au changement de page.
- Pagination serveur (transactions, classement) et CoinGecko (marché), cache backend, recherche débouncée, code-splitting de Recharts.

## 21. Limites du projet

- Cache en mémoire du backend (une instance) ; plusieurs instances auraient chacune leur cache.
- Classement recalculé en mémoire à partir de tous les portefeuilles (adapté à quelques milliers de joueurs, pas plus).
- Prix rafraîchis à la demande (pas de temps réel), granularité liée au cache (30-60 s).
- Pas de frais de transaction, d'ordres limite ni de gestion de plusieurs devises.
- Schéma créé par `create_all` (pas de migrations Alembic) ; jeton en `localStorage` (voir §18 pour l'alternative cookie httpOnly).
- Plan CoinGecko Demo : ~30 appels/minute et historique limité à 365 jours.

## 22. Améliorations possibles

- Cache partagé (Redis) et tâche planifiée de snapshots pour tous les joueurs.
- Classement matérialisé (table de scores mise à jour après chaque trade) et ligues/périodes (classement hebdomadaire).
- Rafraîchissement automatique des prix (polling léger ou WebSocket), alertes de prix.
- Ordres limite / stop-loss, frais de transaction paramétrables, favoris et watchlist.
- Migrations Alembic, refresh tokens, cookies httpOnly, limitation de débit par utilisateur.
- Internationalisation (FR/EN) et mode clair.

## 23. Répartition du travail

_
Données de marché fournies par [CoinGecko](https://www.coingecko.com/). Aucun argent réel n'est utilisé : Crypto Arena est un jeu de simulation à but pédagogique.
