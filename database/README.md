# Base de données — Crypto Arena

PostgreSQL est la seule base supportée en développement et en production (SQLite n'est utilisé
que par la suite de tests automatisés du backend).

## Schéma

Voir [`schema.sql`](schema.sql) (DDL de référence, identique aux modèles SQLAlchemy de
`backend/app/models`).

```
users 1 ──── 1 portfolios 1 ──── * holdings * ──── 1 assets
  │                                                  │
  ├──── * transactions * ────────────────────────────┘
  └──── * portfolio_snapshots
```

| Table                 | Rôle                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `users`               | Comptes (email unique, mot de passe **haché bcrypt**, flag `is_demo`) |
| `portfolios`          | Cash disponible + capital initial (10 000 €) d'un utilisateur         |
| `assets`              | Catalogue des cryptos tradées (identifiant CoinGecko unique)          |
| `holdings`            | Positions courantes : quantité + prix moyen d'achat (méthode du coût moyen) |
| `transactions`        | Journal immuable des achats/ventes (prix fixé par le serveur)          |
| `portfolio_snapshots` | Valorisations horodatées pour le graphique de performance             |

Contraintes notables : `cash_balance >= 0`, `quantity >= 0`, `type IN ('BUY','SELL')`,
`UNIQUE (portfolio_id, asset_id)`, suppressions en cascade depuis `users`.

## Initialisation

1. Créer la base : `createdb crypto_arena` (ou via pgAdmin / `docker compose up -d`).
2. Renseigner `DATABASE_URL` dans `backend/.env`.
3. Créer les tables + le catalogue d'actifs :

```bash
cd backend
python -m app.database.init_db
```

Le backend exécute aussi cette initialisation au démarrage (`AUTO_INIT_DB=true`, idempotent).

## Données de démonstration

```bash
python -m app.database.seed          # crée les comptes de démo manquants
python -m app.database.seed --reset  # supprime les comptes `is_demo = true` puis les recrée
```

Compte principal : `demo@cryptoarena.dev` / `Demo123!` (+ 9 joueurs fictifs pour le classement).
Le script refuse de s'exécuter avec `APP_ENV=production` sauf `--force`.
