# Contribuer à Veilleuse

Merci de ton intérêt ! Quelques règles simples pour garder le projet propre.

## Mise en place

```bash
npm install
npm run dev        # http://localhost:5173
```

## Avant chaque commit

```bash
npm run check      # lint + types + tests + build
npm run test:e2e   # tests de bout en bout (Playwright)
```

## Ajouter du contenu

Tout le contenu (sprites, tuiles, cartes, ennemis, musiques, illustrations, scénario) suit
[`docs/CONTENT_CONTRACT.md`](docs/CONTENT_CONTRACT.md). Les tests `tests/content.test.ts` vérifient automatiquement
que chaque clé référencée existe, que les cartes sont valides (apparitions sur des cases libres, portes vers des
cartes existantes…) et que les musiques se lisent.

Pour vérifier un rendu sans jouer : `node tools/shot.mjs "debug=map&map=village" capture.png`.

## Style

- TypeScript strict, pas de `any`. Prettier (`npm run format`) et ESLint.
- Textes du jeu en français ; code et commentaires en anglais.
- Messages de commit à l'impératif, courts et explicites.
- Pas de spoiler de l'histoire dans les titres de PR ou d'issues.
