# Lab 02 — Modules et Système de Fichiers

## Objectifs

- Lire et écrire des fichiers JSON avec `fs/promises`
- Parser du CSV en objets JavaScript
- Parcourir un répertoire recursivement
- Lire des variables d'environnement avec des valeurs par defaut
- Créer et exporter des modules ESM

## Pre-requis

- Node.js >= 18 installe
- Aucune dépendance externe (pure Node.js)

## Instructions

1. Ouvrez le fichier `exercise.ts`
2. Completez chaque section marquee `TODO`
3. Lancez le fichier avec `npx tsx exercise.ts`
4. Verifiez que tous les tests passent (8/8)

## TODOs

| # | Description |
|---|-------------|
| 1 | Implementer `readJsonFile(filePath)` — lire et parser un fichier JSON |
| 2 | Implementer `writeJsonFile(filePath, data)` — écrire un objet en JSON (formate) |
| 3 | Implementer `parseCsv(csvString)` — parser une chaine CSV en tableau d'objets |
| 4 | Implementer `findJsFiles(dirPath)` — lister recursivement les fichiers .js |
| 5 | Implementer `getConfig(defaults)` — lire des variables d'environnement avec defauts |
| 6 | Implementer le module `createSlugger()` — utilitaire de transformation de chaines |

## Fichiers de donnees

Le dossier `data/` contient :
- `users.json` — liste d'utilisateurs au format JSON
- `products.csv` — liste de produits au format CSV

## Aide

```typescript
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Lire un fichier texte
const content = await readFile('path', 'utf-8');

// Ecrire un fichier
await writeFile('path', content);

// Lister un repertoire
const entries = await readdir('path', { withFileTypes: true });
entries.forEach(entry => {
  entry.isDirectory(); // true si repertoire
  entry.name;          // nom du fichier/repertoire
});
```
