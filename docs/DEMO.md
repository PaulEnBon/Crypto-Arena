# Scénario de démonstration (≈ 10 minutes)

Pré-requis avant la soutenance :

1. Backend lancé (`cd backend && python run.py`) et `GET http://localhost:8000/api/health/coingecko` → 200.
2. Frontend lancé (`cd frontend && npm run dev`) sur http://localhost:5173.
3. Données de démo chargées (`python -m app.database.seed`) pour un classement rempli.
4. Un onglet ouvert sur http://localhost:8000/docs (Swagger) pour montrer l'API si besoin.

| #  | Étape                        | Action                                                                  | Ce qu'il faut montrer / dire                                                                                   |
| -- | ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1  | Arrivée sur le site          | Ouvrir `/`                                                              | Page d'accueil publique, identité visuelle, concept (10 000 € virtuels, prix réels, classement).                |
| 2  | Inscription                  | « Entrer dans l'arène » → remplir le formulaire                          | Validation en direct sous les champs (email invalide, règles du mot de passe), bouton désactivé tant que le formulaire est invalide. Le backend re-valide (Pydantic). |
| 3  | Connexion                    | Se déconnecter puis « Pré-remplir » le compte démo sur `/login`         | JWT stocké, redirection programmatique (`useNavigate`) vers `/dashboard`. Mauvais mot de passe → message d'erreur clair (401). |
| 4  | Dashboard                    | `/dashboard`                                                            | « Bonjour demo 👋 », valeur totale, cash, investissement, P&L, graphique 30 jours (snapshots), rang, tendances, top cryptos, dernières transactions. Chaque bloc a ses états loading/erreur. |
| 5  | Marché                       | `/markets`                                                              | 50 cryptos CoinGecko, tri par colonne, filtre hausse/baisse, pagination, sparklines 7 j. Ouvrir la console : `[Profiler] CryptoTable update …` pour parler de `memo`. |
| 6  | Recherche Bitcoin            | Taper « bitcoin » (puis « pepe » pour la recherche distante)            | Filtre local instantané ; sans correspondance locale, recherche CoinGecko débouncée (`useDebounce`).           |
| 7  | Page détail Bitcoin          | Cliquer sur la ligne                                                    | Route paramétrée `/crypto/:coinId`, graphique historique (1J → 1A), statistiques, description, formulaire de trading. |
| 8  | Achat virtuel                | Quantité `0.02` → « Acheter BTC » → confirmer                            | Total estimé et solde après achat en direct ; modale de confirmation ; le message du serveur indique le prix **réellement** appliqué (déterminé côté backend). Cash mis à jour dans la barre. |
| 9  | Portefeuille                 | `/portfolio`                                                            | Répartition (donut), positions valorisées en direct (prix moyen, P&L, allocation), historique paginé.          |
| 10 | Vente virtuelle              | Retour sur BTC → onglet « Vendre » → `Max` ou `0.01` → confirmer         | Validation conditionnelle : vendre plus que détenu est refusé côté client **et** serveur (`INSUFFICIENT_HOLDINGS`). |
| 11 | Historique                   | `/portfolio` → historique                                               | Les deux opérations (BUY/SELL) avec date, prix unitaire, total ; pagination.                                   |
| 12 | Classement                   | `/leaderboard`                                                          | Podium, votre ligne surlignée, formule de performance calculée côté serveur, pagination.                        |
| 13 | Profil                       | `/profile`                                                              | Email, date d'inscription, capital initial/actuel, transactions, rang ; modification du nom d'utilisateur (409 si déjà pris). |
| 14 | Erreur API                   | Ouvrir `/crypto/does-not-exist` ; ou `GET /api/health/coingecko` ; ou couper le backend et rafraîchir `/markets` | Message compréhensible + bouton « Réessayer », jamais de page blanche. Codes 404 / 429 / 503 mappés.            |
| 15 | Déconnexion                  | Bouton « Déconnexion »                                                  | Jeton supprimé, toast, redirection `/login`; `/dashboard` redirige vers `/login` (route protégée).             |

Bonus si le temps le permet : `/une/route/inconnue` → page 404 ; Swagger `/docs` ; `npm run test` et `pytest` en direct.

## Plan B

- **CoinGecko limite atteinte (429)** : le backend sert les données en cache (jusqu'à 60 s) ou périmées (*stale-while-error*) ; le message est explicite sinon. Attendre 1 minute.
- **CoinGecko injoignable** : le portefeuille et le classement passent en mode dégradé (prix moyen d'achat, bandeau d'avertissement) au lieu d'échouer.
- **Base de données** : `python -m app.database.seed --reset` remet les comptes de démo à zéro (le compte personnel créé pendant la démo n'est pas touché).
