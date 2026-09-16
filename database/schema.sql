-- ============================================================================
-- Crypto Arena — schéma PostgreSQL de référence
-- ----------------------------------------------------------------------------
-- Ce fichier documente le schéma créé automatiquement par SQLAlchemy
-- (backend/app/models, `python -m app.database.init_db`). Il peut aussi être
-- exécuté tel quel :  psql -U postgres -d crypto_arena -f database/schema.sql
-- ============================================================================

CREATE DATABASE crypto_arena;  -- à exécuter une seule fois, hors transaction
\connect crypto_arena

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(20)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,              -- bcrypt, jamais en clair
    is_demo       BOOLEAN      NOT NULL DEFAULT FALSE, -- comptes de démonstration (seed)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

-- ---------------------------------------------------------------- portfolios
CREATE TABLE IF NOT EXISTS portfolios (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    cash_balance    NUMERIC(20, 2) NOT NULL,
    initial_balance NUMERIC(20, 2) NOT NULL,           -- 10 000 € par défaut
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_portfolios_cash_non_negative CHECK (cash_balance >= 0),
    CONSTRAINT ck_portfolios_initial_positive  CHECK (initial_balance > 0)
);
CREATE INDEX IF NOT EXISTS ix_portfolios_user_id ON portfolios (user_id);

-- ---------------------------------------------------------------- assets
CREATE TABLE IF NOT EXISTS assets (
    id           SERIAL PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    coingecko_id VARCHAR(100) NOT NULL UNIQUE,         -- ex: "bitcoin"
    image_url    VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS ix_assets_coingecko_id ON assets (coingecko_id);

-- ---------------------------------------------------------------- holdings
-- Position courante d'un portefeuille sur un actif (quantité + prix moyen d'achat).
-- Dérivée des transactions mais stockée pour des lectures/verrouillages efficaces.
CREATE TABLE IF NOT EXISTS holdings (
    id            SERIAL PRIMARY KEY,
    portfolio_id  INTEGER        NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
    asset_id      INTEGER        NOT NULL REFERENCES assets (id) ON DELETE RESTRICT,
    quantity      NUMERIC(28, 8) NOT NULL DEFAULT 0,
    avg_buy_price NUMERIC(20, 8) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_holdings_portfolio_asset      UNIQUE (portfolio_id, asset_id),
    CONSTRAINT ck_holdings_quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT ck_holdings_avg_price_non_negative CHECK (avg_buy_price >= 0)
);
CREATE INDEX IF NOT EXISTS ix_holdings_portfolio_id ON holdings (portfolio_id);
CREATE INDEX IF NOT EXISTS ix_holdings_asset_id     ON holdings (asset_id);

-- ---------------------------------------------------------------- transactions
CREATE TABLE IF NOT EXISTS transactions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    asset_id   INTEGER        NOT NULL REFERENCES assets (id) ON DELETE RESTRICT,
    type       VARCHAR(4)     NOT NULL,                -- BUY | SELL
    quantity   NUMERIC(28, 8) NOT NULL,
    price      NUMERIC(20, 8) NOT NULL,                -- prix unitaire EUR fixé par le serveur
    total      NUMERIC(20, 2) NOT NULL,                -- montant réellement débité/crédité
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_transactions_type              CHECK (type IN ('BUY', 'SELL')),
    CONSTRAINT ck_transactions_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ck_transactions_price_positive    CHECK (price > 0),
    CONSTRAINT ck_transactions_total_positive    CHECK (total > 0)
);
CREATE INDEX IF NOT EXISTS ix_transactions_user_id      ON transactions (user_id);
CREATE INDEX IF NOT EXISTS ix_transactions_asset_id     ON transactions (asset_id);
CREATE INDEX IF NOT EXISTS ix_transactions_user_created ON transactions (user_id, created_at);

-- ---------------------------------------------------------------- portfolio_snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    total_value NUMERIC(20, 2) NOT NULL,
    profit_loss NUMERIC(20, 2) NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_portfolio_snapshots_user_id ON portfolio_snapshots (user_id);
CREATE INDEX IF NOT EXISTS ix_snapshots_user_created      ON portfolio_snapshots (user_id, created_at);

-- ---------------------------------------------------------------- catalogue initial (optionnel)
-- Le backend insère lui-même ce catalogue au démarrage (AUTO_INIT_DB) et l'enrichit via CoinGecko.
INSERT INTO assets (coingecko_id, symbol, name) VALUES
    ('bitcoin', 'BTC', 'Bitcoin'), ('ethereum', 'ETH', 'Ethereum'), ('tether', 'USDT', 'Tether'),
    ('binancecoin', 'BNB', 'BNB'), ('solana', 'SOL', 'Solana'), ('ripple', 'XRP', 'XRP'),
    ('dogecoin', 'DOGE', 'Dogecoin'), ('cardano', 'ADA', 'Cardano'), ('tron', 'TRX', 'TRON'),
    ('avalanche-2', 'AVAX', 'Avalanche'), ('chainlink', 'LINK', 'Chainlink'), ('polkadot', 'DOT', 'Polkadot'),
    ('litecoin', 'LTC', 'Litecoin'), ('shiba-inu', 'SHIB', 'Shiba Inu'), ('uniswap', 'UNI', 'Uniswap'),
    ('stellar', 'XLM', 'Stellar'), ('polygon-ecosystem-token', 'POL', 'POL (ex-MATIC)'),
    ('near', 'NEAR', 'NEAR Protocol'), ('monero', 'XMR', 'Monero'), ('bitcoin-cash', 'BCH', 'Bitcoin Cash')
ON CONFLICT (coingecko_id) DO NOTHING;
