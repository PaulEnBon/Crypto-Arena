# Documentation de l'API — Crypto Arena

Base URL locale : `http://localhost:8000/api`
Documentation interactive générée par FastAPI (OpenAPI) : `http://localhost:8000/docs` (Swagger UI) et `http://localhost:8000/redoc`.

## Conventions

- Format : JSON (`Content-Type: application/json`).
- Authentification : en-tête `Authorization: Bearer <access_token>` (JWT obtenu via `/auth/register` ou `/auth/login`).
- Montants en **euros** (`vs_currency=eur`), quantités avec au plus 8 décimales.
- **Erreurs** : toutes les réponses d'erreur ont la même forme :

```json
{ "detail": "Fonds insuffisants : 327130.00 € requis, 9505.00 € disponibles.", "code": "INSUFFICIENT_FUNDS" }
```

| HTTP | `code`                                                             | Situation                                             |
| ---- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 400  | `INVALID_QUANTITY`, `INSUFFICIENT_FUNDS`, `INSUFFICIENT_HOLDINGS`  | Règle métier du trading violée                        |
| 401  | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `INVALID_TOKEN` | Non connecté / mauvais identifiants / jeton expiré |
| 403  | `EMAIL_NOT_VERIFIED`                                               | Connexion Google / GitHub avec un email non vérifié   |
| 404  | `NOT_FOUND`, `COIN_NOT_FOUND`, `HTTP_ERROR`                        | Ressource ou cryptomonnaie inexistante                |
| 409  | `EMAIL_TAKEN`, `USERNAME_TAKEN`                                    | Conflit d'unicité                                     |
| 422  | `VALIDATION_ERROR` (+ tableau `errors[{field, message}]`)          | Corps ou paramètres invalides (Pydantic)              |
| 429  | `COINGECKO_RATE_LIMIT`                                             | Limite d'appels CoinGecko atteinte                    |
| 500  | `DATABASE_ERROR`, `INTERNAL_ERROR`                                 | Erreur PostgreSQL / erreur inattendue                 |
| 502  | `COINGECKO_ERROR`, `INVALID_PRICE`                                 | Réponse CoinGecko invalide / prix indisponible        |
| 503  | `COINGECKO_UNAVAILABLE`                                            | CoinGecko injoignable (timeout, réseau)               |
| 503  | `OAUTH_DISABLED`, `OAUTH_UNAVAILABLE`                              | Connexion Google / GitHub non configurée, ou Neon Auth injoignable |

Pagination : les listes paginées renvoient l'enveloppe générique `Paginated<T>` :

```json
{ "items": [], "page": 1, "page_size": 20, "total": 57, "total_pages": 3 }
```

---

## Santé

| Méthode | Route                   | Auth | Description                                                                 |
| ------- | ----------------------- | ---- | --------------------------------------------------------------------------- |
| GET     | `/health`               | non  | État de l'API et de PostgreSQL (`503` si la base est injoignable)           |
| GET     | `/health/coingecko`     | non  | Ping CoinGecko : `200` disponible, `429` limite atteinte, `500` erreur CoinGecko, `503` indisponible. Renvoie aussi la latence et les statistiques du cache. |

```json
{ "status": "ok", "http_status": 200, "latency_ms": 186.8, "message": "(V3) To the Moon!", "cache_entries": 19,
  "stats": { "requests": 9, "cache_hits": 21, "stale_hits": 0, "errors": 0 } }
```

## Authentification

| Méthode | Route            | Auth | Corps                                                   | Réponse                                  |
| ------- | ---------------- | ---- | ------------------------------------------------------- | ---------------------------------------- |
| POST    | `/auth/register` | non  | `{ username, email, password, password_confirm }`       | `201` `{ access_token, token_type, expires_in, user }` |
| POST    | `/auth/login`    | non  | `{ email, password }`                                   | `200` idem                               |
| POST    | `/auth/oauth`    | non  | `{ token }` : JWT délivré par Neon Auth                 | `200` `{ access_token, token_type, expires_in, user }` |
| GET     | `/auth/me`       | oui  | —                                                       | `{ id, username, email, created_at, is_demo }` |

Règles de validation (client **et** serveur) : username `[A-Za-z0-9_]{3,20}`, email valide, mot de passe ≥ 8 caractères avec majuscule, minuscule et chiffre, confirmation identique. Chaque inscription crée un portefeuille avec `INITIAL_BALANCE` (10 000 €).

**`POST /auth/oauth` (Google / GitHub)** : le frontend obtient le jeton auprès de Neon Auth après la redirection OAuth. Le backend vérifie la signature EdDSA avec `<NEON_AUTH_URL>/.well-known/jwks.json`, l'émetteur et l'audience (Auth URL ou son origine), `exp`/`iat` (tolérance de 30 s), refuse les jetons anonymes et les emails non vérifiés, puis : retrouve le joueur par son identifiant Neon (`sub`), sinon relie le compte existant ayant le même email, sinon crée un joueur (nom dérivé du profil, suffixe numérique si déjà pris) avec son portefeuille de départ. Réponse identique à `/auth/login`.

```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"demo@cryptoarena.dev","password":"Demo123!"}'
```

## Cryptomonnaies (proxy CoinGecko, mis en cache)

| Méthode | Route                        | Paramètres                                                                                     | CoinGecko utilisé            |
| ------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| GET     | `/crypto/markets`            | `page` (1-50), `per_page` (1-100), `order` (`market_cap_desc`, `market_cap_asc`, `volume_desc`, `volume_asc`, `id_asc`, `id_desc`), `ids` (liste séparée par virgules) | `/coins/markets` (sparkline 7 j, variation 24 h/7 j) |
| GET     | `/crypto/trending`           | —                                                                                              | `/search/trending`           |
| GET     | `/crypto/search`             | `q` (1-50 caractères)                                                                          | `/search`                    |
| GET     | `/crypto/prices`             | `ids` (obligatoire)                                                                            | `/simple/price`              |
| GET     | `/crypto/{coin_id}`          | —                                                                                              | `/coins/{id}` (market_data)  |
| GET     | `/crypto/{coin_id}/history`  | `days` (1-365, défaut 7)                                                                       | `/coins/{id}/market_chart`   |

Réponse `/crypto/markets` (extrait) :

```json
{ "page": 1, "per_page": 50, "order": "market_cap_desc", "has_next": true,
  "coins": [ { "id": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "image": "https://…", "current_price": 65673,
               "market_cap": 1.31e12, "market_cap_rank": 1, "total_volume": 3.4e10, "high_24h": 66862, "low_24h": 65021,
               "price_change_percentage_24h": -1.49, "price_change_percentage_7d": -4.08, "sparkline_7d": [ … 168 points … ] } ] }
```

Réponse `/crypto/{coin_id}/history` : `{ "coin_id": "bitcoin", "vs_currency": "eur", "days": 7, "prices": [ { "timestamp": 1789000000000, "price": 65000.1 } ] }`.

## Portefeuille (authentifié)

| Méthode | Route                     | Paramètres                              | Description                                                        |
| ------- | ------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| GET     | `/portfolio`              | —                                       | Valorisation complète avec les prix CoinGecko courants. Enregistre un snapshot au plus une fois par heure. |
| GET     | `/portfolio/transactions` | `page`, `page_size` (1-100, défaut 20)  | Historique paginé, du plus récent au plus ancien                   |
| GET     | `/portfolio/snapshots`    | `days` (1-365, défaut 30)               | Points de valorisation pour le graphique de performance            |

Réponse `/portfolio` :

```json
{ "cash_balance": 8687.14, "initial_balance": 10000, "invested_amount": 1312.86, "holdings_value": 1312.68,
  "total_value": 9999.82, "profit_loss": -0.18, "performance_pct": 0.0, "updated_at": "2026-09-16T09:16:00Z",
  "assets": [ { "asset_id": 1, "coin_id": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "image_url": "https://…",
                "quantity": 0.02, "avg_buy_price": 65643, "current_price": 65634, "price_change_24h": -1.56,
                "price_source": "live", "value": 1312.68, "invested": 1312.86, "profit_loss": -0.18,
                "profit_loss_pct": -0.01, "allocation_pct": 13.13 } ] }
```

`price_source` vaut `fallback` lorsque CoinGecko est indisponible : la position est alors valorisée à son prix moyen d'achat (mode dégradé, signalé dans l'interface).

## Trading (authentifié)

| Méthode | Route          | Corps                                 | Réponse                                                    |
| ------- | -------------- | ------------------------------------- | ---------------------------------------------------------- |
| POST    | `/trades/buy`  | `{ "coin_id": "bitcoin", "quantity": 0.01 }` | `201` `{ message, transaction, portfolio }`         |
| POST    | `/trades/sell` | idem                                  | `201` idem                                                 |

Le client n'envoie **jamais** de prix. Le serveur : authentifie → valide la quantité (> 0, ≤ 8 décimales) → résout l'actif (créé à la volée si CoinGecko le connaît) → récupère le prix EUR courant → calcule le total arrondi au centime (≥ 0,01 €) → verrouille le portefeuille (`SELECT … FOR UPDATE`) → vérifie solde / quantité détenue → met à jour cash + position (coût moyen) → enregistre la transaction → commit → renvoie le portefeuille revalorisé.

## Classement (authentifié)

| Méthode | Route              | Paramètres                            | Description                                                              |
| ------- | ------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| GET     | `/leaderboard`     | `page`, `page_size` (1-100, défaut 20) | Classement global par `performance_pct`, calculé côté serveur (cache 30 s, invalidé après chaque trade) |
| GET     | `/leaderboard/me`  | —                                     | Position du joueur connecté                                              |

```json
{ "items": [ { "rank": 1, "user_id": 2, "username": "CryptoMaster", "initial_balance": 10000, "portfolio_value": 12275.51,
               "profit_loss": 2275.51, "performance_pct": 22.76, "is_current_user": false } ],
  "page": 1, "page_size": 20, "total": 12, "total_pages": 1, "total_players": 12, "computed_at": "2026-09-16T09:16:12Z" }
```

`performance_pct = (portfolio_value − initial_balance) / initial_balance × 100`.

## Profil (authentifié)

| Méthode | Route      | Corps                     | Description                                                                 |
| ------- | ---------- | ------------------------- | --------------------------------------------------------------------------- |
| GET     | `/profile` | —                         | Utilisateur + capital initial/actuel, P&L, performance, nombre de transactions, rang |
| PATCH   | `/profile` | `{ "username": "Nouveau" }` | Modifie le nom d'utilisateur (unicité insensible à la casse)              |
