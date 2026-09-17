# Fiche de soutenance — explications techniques

Chaque section donne, en quelques phrases, ce qu'il faut savoir expliquer à l'oral, avec le fichier à ouvrir si le jury veut voir le code.

## 1. Architecture générale

React ne parle **qu'au backend FastAPI**, jamais à CoinGecko directement :

```
React (Vite, TS)  ──HTTP JSON──▶  FastAPI  ──httpx──▶  CoinGecko API v3
        ▲                           │
        └──── JWT Bearer ───────────┤
                                    ▼
                               PostgreSQL
```

Pourquoi : la clé API reste secrète côté serveur, le backend met en cache les réponses (rate limit CoinGecko) et surtout **le prix d'une transaction est décidé par le serveur**, pas par le navigateur (on ne fait jamais confiance au client). Fichiers : `backend/app/main.py`, `frontend/src/services/apiClient.ts`.

## 2. Authentification (JWT + bcrypt)

- Le mot de passe est haché avec **bcrypt** (facteur de coût 12, sel intégré) → jamais stocké en clair, impossible à inverser. Le hachage tourne dans un thread (`asyncio.to_thread`) pour ne pas bloquer la boucle d'événements (`services/auth_service.py`).
- À la connexion, le serveur émet un **JWT** signé (HS256, secret `JWT_SECRET`) contenant `sub` (id utilisateur) et `exp`. Le frontend l'envoie dans `Authorization: Bearer …` ; la dépendance `get_current_user` le vérifie à chaque requête protégée (`auth/dependencies.py`).
- Jeton expiré → 401 `TOKEN_EXPIRED` → le client déclenche un événement global, vide la session et affiche « Votre session a expiré » (`AppProvider.tsx`).
- Le jeton est en `localStorage` (persistance au rafraîchissement). Alternative discutable : cookie httpOnly (protège du XSS mais impose CSRF + même domaine) — choix assumé pour un projet déployé sur deux domaines (Vercel + Render).

### Connexion Google et GitHub (Neon Auth)

Phrase à retenir : **Neon Auth prouve l'identité, notre backend décide de l'accès.**

1. Le bouton « Continuer avec Google » charge le SDK Neon Auth à la demande (`neonAuthService.ts`, import dynamique) et redirige vers Google.
2. Google renvoie vers Neon Auth, qui crée l'utilisateur dans le schéma `neon_auth` de la base, puis redirige vers `/auth/callback` avec un **vérificateur de session à usage unique** dans l'URL.
3. La page de retour (`OAuthCallbackPage.tsx`) échange ce vérificateur contre un **JWT Neon** signé en Ed25519, valable quelques minutes.
4. Elle l'envoie à `POST /api/auth/oauth`. Le backend (`neon_auth_service.py`) vérifie la signature avec les **clés publiques** de Neon (JWKS, mises en cache), l'émetteur, l'audience et l'expiration.
5. `sign_in_with_neon_identity` retrouve le joueur par son identifiant Neon, sinon relie un compte existant au **même email vérifié**, sinon crée un joueur avec ses 10 000 €. Le backend renvoie alors **son propre JWT** : le reste de l'application ne voit aucune différence.

Pourquoi cet « échange de jeton » plutôt que remplacer notre authentification :

- les critères notés (bcrypt, JWT, formulaires validés) restent intacts, Google/GitHub s'ajoutent à côté ;
- une seule façon de protéger les routes (`get_current_user`), donc rien à modifier dans le trading ou le classement ;
- le jeton Neon ne sert qu'une fois : la session ne dépend pas des cookies tiers du domaine Neon, que certains navigateurs bloquent ;
- asymétrique : Neon signe avec une clé privée, nous vérifions avec la clé publique, aucun secret partagé à stocker.

Points de sécurité à citer : jetons anonymes de Neon refusés (ils sont signés avec la même clé mais n'identifient personne), email non vérifié refusé (sinon quelqu'un pourrait se faire passer pour un joueur existant), algorithme imposé (`EdDSA` uniquement), tolérance d'horloge de 30 s mesurée entre notre machine et Neon, comptes Google/GitHub sans mot de passe utilisable (marqueur commençant par `!`, comme Django), domaine Vercel déclaré dans les domaines autorisés de Neon Auth.

Base de données : la colonne `users.neon_auth_id` (unique, nullable) a été ajoutée par une **migration idempotente** (`app/database/migrations.py`, `ADD COLUMN IF NOT EXISTS`), testée deux fois sur un PostgreSQL 18 local avant d'être appliquée à Neon, sans perte de données.

## 3. Moteur de trading

`services/trade_service.py` — la fonction `execute_trade` fait, dans une seule transaction SQL :

1. validation de la quantité (> 0, ≤ 8 décimales, bornée) ;
2. résolution de l'actif (`get_or_create_asset` : si la crypto n'est pas au catalogue, on vérifie qu'elle existe sur CoinGecko et on la crée — SAVEPOINT pour gérer une création concurrente) ;
3. prix EUR courant via `/simple/price` (cache 30 s par coin) ;
4. `total = quantité × prix` arrondi au centime (`ROUND_HALF_UP`), refus si < 0,01 € (sinon on pourrait obtenir des jetons gratuits par arrondi) ;
5. `SELECT … FOR UPDATE` sur le portefeuille puis sur la position → deux achats simultanés du même utilisateur ne peuvent pas dépasser le solde (verrou ligne PostgreSQL, ordre de verrouillage constant = pas d'interblocage) ;
6. contrôles métier (`INSUFFICIENT_FUNDS`, `INSUFFICIENT_HOLDINGS`) ;
7. mise à jour du cash et de la position, insertion dans `transactions`, `commit`.

**Méthode du coût moyen** : à chaque achat, `prix_moyen = (qté × prix_moyen + q × prix) / (qté + q)` ; une vente ne change pas le prix moyen. P&L d'une position = `(prix_actuel − prix_moyen) × quantité`. Tout est calculé en `Decimal` (pas de flottants pour l'argent).

## 4. Base de données

Six tables (`database/schema.sql`) : `users`, `portfolios`, `assets`, `holdings`, `transactions`, `portfolio_snapshots`. `holdings` est une table de **position courante** dérivée des transactions : elle évite de recalculer des sommes à chaque lecture et donne une ligne à verrouiller. Contraintes `CHECK` (cash ≥ 0, quantités > 0, type ∈ {BUY, SELL}), `UNIQUE (portfolio_id, asset_id)`, suppressions en cascade. Les comptes de démo portent `is_demo = true` pour rester séparés des vrais comptes.

SQLAlchemy 2.0 en mode **async** (`postgresql+psycopg`) : les requêtes n'occupent pas de thread pendant les allers-retours avec PostgreSQL, ce qui s'accorde avec les appels httpx asynchrones vers CoinGecko.

## 5. Service CoinGecko

`services/coingecko_service.py` centralise tous les appels (rien d'autre ne connaît l'URL ou la clé) :

- en-tête `x-cg-demo-api-key` (plan Demo) ;
- **cache TTL** en mémoire par endpoint + paramètres (marchés 60 s, prix 30 s, détail 120 s, historique 300 s, recherche 600 s) → la page Marché rafraîchie 10 fois en une minute ne coûte qu'un appel ;
- cache **par coin** pour les prix : le trade, le portefeuille et le classement partagent la même cotation ;
- **single-flight** : deux requêtes identiques simultanées ne déclenchent qu'un appel amont ;
- sémaphore (4 appels concurrents max), timeout 10 s, 2 tentatives avec back-off, respect de `Retry-After` ;
- **stale-while-error** : si CoinGecko tombe (429/5xx/timeout) et qu'une valeur périmée existe, on la sert au lieu d'échouer ;
- erreurs converties en exceptions métier → HTTP 404 (`COIN_NOT_FOUND`), 429, 502, 503, jamais de 500 opaque. `GET /api/health/coingecko` permet de vérifier l'état en direct.

Sur la démo réalisée pendant le développement : 9 appels CoinGecko pour 30 requêtes applicatives (21 cache hits).

## 6. Classement

`services/leaderboard_service.py` : trois requêtes SQL (portefeuilles, positions, actifs) + **un seul** appel `/simple/price` pour toutes les cryptos détenues, puis calcul en mémoire de `performance = (valeur − capital initial) / capital initial × 100`, tri (performance, puis valeur, puis nom), attribution des rangs. Résultat mis en cache 30 s et invalidé après chaque transaction ; la pagination est faite sur ce résultat. Le frontend ne trie jamais lui-même.

## 7. État global React (Context + useReducer)

`context/appReducer.ts` : `AppState { user, portfolio, isAuthenticated, loading, error }` et une union discriminée d'actions (`LOGIN`, `LOGOUT`, `SET_USER`, `SET_PORTFOLIO`, `UPDATE_PORTFOLIO`, `SET_LOADING`, `SET_ERROR`). Le reducer est **pur et immuable** (spread, jamais de mutation ; testé dans `tests/appReducer.test.ts` avec `Object.freeze`). `AppProvider.tsx` expose l'état et des actions stables (`useCallback`) via `AppContext`. Un second contexte (`ToastProvider`) gère les notifications, aussi avec `useReducer`.

Pourquoi `useReducer` plutôt que plusieurs `useState` : les transitions (login, logout, mise à jour du portefeuille) touchent plusieurs champs à la fois ; un reducer les rend atomiques, typées et testables.

## 8. Hooks personnalisés

| Hook                          | Rôle                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `useAsync<T>` (générique)     | Cycle loading / success / error de n'importe quelle requête, `AbortController`, protection contre les *race conditions*, `refetch` |
| `useCoinGecko.ts` (`useMarkets`, `useCoin`, `useCoinHistory`, `useTrending`, `useCoinSearch`) | Hooks de données de marché construits sur `useAsync` |
| `useAuth`                     | Tranche authentification du contexte global                                                   |
| `usePortfolio`                | Portefeuille du contexte + rechargement au montage + `getHolding(coinId)`                      |
| `useDebounce`                 | Retarde la recherche distante (une requête par pause de frappe, pas par touche)               |
| `useLeaderboard` / `useMyRank`| Classement paginé et position du joueur                                                       |

**Race condition** (`useAsync.ts`) : quand les dépendances changent (ex. période du graphique 7J → 30J), l'ancienne requête est annulée (`controller.abort()`) et un drapeau `active` ignore sa réponse si elle arrive quand même. Test : `tests/useAsync.test.tsx` (« ignore la réponse tardive »).

## 9. Formulaires contrôlés

`LoginForm`, `RegisterForm`, `TransactionForm` : chaque champ est lié à un `useState`, validé à chaque frappe par des fonctions pures de `utils/validation.ts` (réutilisées côté tests). Les erreurs s'affichent sous le champ concerné (`FormField`, `role="alert"`), après `blur` pour ne pas agresser l'utilisateur, et le bouton reste désactivé tant que le formulaire est invalide. Le formulaire de trading calcule le total et le solde après opération en direct, puis demande confirmation (`Modal`). Le backend re-valide tout (Pydantic + règles métier).

## 10. Routing

React Router (API v6 : `Routes`, `Route`, `Outlet`, `useNavigate`, `useParams`). Routes imbriquées : `ProtectedRoute` (garde) → `AppLayout` (navbar + sidebar + `<Outlet />`) → pages. `/crypto/:coinId` est la route paramétrée ; `*` affiche la page 404. Navigation programmatique après connexion/inscription, déconnexion, clic sur une ligne du marché, boutons de la 404. `ProtectedRoute` mémorise la page demandée (`state.from`) pour y revenir après connexion.

## 11. TypeScript

- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (voir `tsconfig.app.json`, commenté) ; `tsc --noEmit` passe sans erreur ; ESLint interdit `any` (`@typescript-eslint/no-explicit-any: error`). Aucun `any` dans le projet.
- Types métier dans `src/types` : `User`, `Crypto`, `MarketData`, `Portfolio`, `PortfolioAsset`, `Transaction`, `LeaderboardEntry`, `ApiError`, `ApiResponse<T>`…
- Unions : `TransactionType = 'BUY' | 'SELL'`, `HistoryRange = 1 | 7 | 30 | 90 | 365`, `ApiErrorCode`, `AppAction` (union discriminée).
- Génériques écrits par le groupe : `Paginated<T>` (miroir du `Paginated[T]` Pydantic côté backend), `ApiResponse<T>` (union discriminée idle/loading/success/error), `useAsync<T>`, `request<T>()` dans le client API, `useDebounce<T>`.
- Le seul « cast » est `payload as T` dans `apiClient.ts` : frontière assumée entre le contrat backend et le typage UI.

## 12. Composants

Plus de 30 composants ; réutilisables avec `children` : `Card`, `Modal`, `Button`, `Badge`. Toutes les props sont typées (interfaces exportées). Composants « métier » : `CryptoTable`, `CryptoCard`, `PriceChart`, `PerformanceChart`, `AllocationChart`, `PortfolioSummary`, `HoldingsTable`, `TransactionHistory`, `TransactionForm`, `LeaderboardTable`, `LoginForm`, `RegisterForm`, `Navbar`, `Sidebar`, `LoadingSpinner`, `ErrorMessage`, `EmptyState`, `Pagination`…

## 13. Performance — mesurer avant d'optimiser

- `MarketsPage` enveloppe `CryptoTable` dans `<Profiler>` (dev uniquement, `utils/profiler.ts`) : la console affiche `[Profiler] CryptoTable update: 3.8 ms (sans memo ≈ 64 ms)` pendant la saisie dans la recherche. C'est la mesure qui justifie les optimisations ci-dessous.
- `memo(CryptoRow)` : 50-100 lignes avec sparkline, le parent se re-rend à chaque frappe → seules les lignes dont l'objet `coin` change sont re-rendues. Nécessite un `onSelect` stable → `useCallback` dans la page.
- `memo(Sparkline)` : évite de recalculer le chemin SVG (168 points) à chaque rendu du tableau.
- `useMemo` : filtrage + tri des cryptos (`MarketsPage`), transformation des points pour Recharts (`PriceChart`, `PerformanceChart`, `AllocationChart`), valeur des contextes.
- **Pas** de memo sur `LeaderboardTable` ou `TransactionHistory` : ils ne se re-rendent qu'au changement de page, le coût de la comparaison des props serait supérieur au gain.
- Côté données : pagination serveur (transactions, classement) et CoinGecko (marchés), cache backend, debounce de la recherche, split du bundle Recharts (`manualChunks`).

## 14. Tests

- Frontend (Vitest + Testing Library, `npm run test`, 24 tests) : `LoginForm` (validation, soumission), `TransactionForm` (validation **conditionnelle** BUY/SELL, confirmation), `MarketsPage` (spinner de chargement, erreur API + « Réessayer »), `useAsync` (états, race condition, abort), `appReducer` (immutabilité), `validation`.
- Backend (pytest + httpx, `pytest`, 41 tests, SQLite en mémoire + faux service CoinGecko) : inscription/connexion/JWT expiré, achats/ventes et toutes les erreurs métier, valorisation, classement, profil, service CoinGecko (cache, stale, 429, 404, réseau) avec un transport HTTP simulé.

## 15. Sécurité

Mots de passe bcrypt ; JWT signé avec un secret hors dépôt ; clé CoinGecko uniquement dans `backend/.env` ; `.env` ignoré par git, `.env.example` fourni ; validation Pydantic + règles métier côté serveur ; requêtes paramétrées via SQLAlchemy (pas d'injection SQL) ; CORS restreint aux origines listées dans `CORS_ORIGINS` (jamais `*` en production) ; messages d'erreur génériques à la connexion (pas d'énumération des emails) ; comptes de démo isolés (`is_demo`).

## 16. Déploiement

Trois hébergeurs, tous gratuits : frontend statique sur **Vercel** (`VITE_API_URL` = URL publique du backend, réécriture SPA vers `index.html`), backend sur **Render** en instance `free` (`render.yaml`, région Francfort), PostgreSQL sur **Neon** (région Francfort, même zone que le backend pour limiter la latence). Les tables sont créées au démarrage (`AUTO_INIT_DB`). CORS configuré par variable d'environnement.

Questions probables sur ces choix :

- *Pourquoi pas la base PostgreSQL de Render ?* → sur l'offre gratuite, elle expire 30 jours après sa création ; Neon est gratuit sans expiration.
- *Pourquoi l'URL Neon directe et pas l'URL « pooler » ?* → le pooler PgBouncer sert surtout aux fonctions serverless qui ouvrent une connexion par requête. Notre backend est un serveur long qui a déjà son propre pool SQLAlchemy (15 connexions maximum) et crée le schéma au démarrage, opération que Neon recommande de faire en connexion directe.
- *Que se passe-t-il quand Neon se met en veille ?* → la compute s'arrête après 5 minutes d'inactivité ; `pool_pre_ping=True` détecte les connexions mortes et les remplace, la première requête prend quelques centaines de millisecondes de plus.
- *Et la veille de Render ?* → l'instance gratuite s'endort après 15 minutes sans trafic et met environ une minute à redémarrer : on la réveille avant la démonstration en ouvrant `/api/health`.

## 17. Limites et pistes

Cache en mémoire (un seul processus) → Redis pour plusieurs instances ; classement recalculé en mémoire → vue matérialisée ou table de scores pour des milliers de joueurs ; pas de rafraîchissement automatique des prix (polling/WebSocket possible) ; pas de frais de transaction ni d'ordres limite ; pas de migrations Alembic (schéma créé par `create_all`) ; jeton en `localStorage`.

## 18. Questions probables du jury

- *Pourquoi le prix n'est-il pas envoyé par le frontend ?* → pour empêcher la triche et garantir la cohérence : la source de vérité est le serveur (cf. §3).
- *Que se passe-t-il si CoinGecko tombe ?* → cache périmé servi si disponible, sinon 503 explicite ; portefeuille/classement en mode dégradé (§5).
- *Pourquoi `useReducer` et pas Redux ?* → périmètre réduit (session + portefeuille), Context + reducer suffit et reste typé (§7).
- *Comment évitez-vous les doubles achats simultanés ?* → transaction SQL + `FOR UPDATE` (§3).
- *Pourquoi Tailwind ?* → système de design (tokens `@theme`) cohérent et rapide, classes utilitaires composées dans quelques classes maison (`card`, `input`, `nav-link`).
- *Pourquoi PostgreSQL et pas SQLite ?* → contraintes, `NUMERIC`, verrous ligne, concurrence ; SQLite ne sert qu'aux tests.
- *Comment savez-vous que le jeton Google n'est pas falsifié ?* → nous ne recevons jamais le jeton de Google : Neon Auth nous donne un JWT signé en Ed25519 que nous vérifions avec ses clés publiques ; un jeton modifié ou signé par une autre clé est rejeté (testé).
- *Que se passe-t-il si un joueur inscrit par email se connecte ensuite avec Google ?* → même compte, relié par l'email, uniquement si Google l'a vérifié ; son mot de passe continue de fonctionner.
