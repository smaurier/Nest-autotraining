# Lab 03 — Streams

## Objectifs

- Comprendre les streams Node.js (Readable, Writable, Transform)
- Copier un fichier avec des streams
- Créer des Transform streams personnalises
- Utiliser `pipeline()` pour chainer des streams

## Pre-requis

- Node.js >= 18 installe
- Aucune dépendance externe (pure Node.js)

## Instructions

1. Ouvrez le fichier `exercise.ts`
2. Completez chaque section marquee `TODO`
3. Lancez le fichier avec `npx tsx exercise.ts`
4. Verifiez que tous les tests passent (6/6)

## TODOs

| # | Description |
|---|-------------|
| 1 | Implementer `copyFile(src, dest)` — copie avec streams et pipeline |
| 2 | Créer `UppercaseTransform` — Transform stream qui convertit en majuscules |
| 3 | Créer `LineCounterTransform` — Transform stream qui compte les lignes |
| 4 | Créer `CsvToJsonTransform` — Transform stream qui convertit CSV en JSON |
| 5 | Implementer `processFile(src, dest)` — chaine plusieurs transforms avec pipeline |

## Fichiers de donnees

Le lab créé automatiquement les fichiers de test suivants :
- `input.txt` — texte multi-ligne pour les tests
- `data.csv` — donnees CSV pour le test de conversion

## Aide

```typescript
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';

// Creer un Transform stream
class MyTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // chunk est un Buffer, convertir en string si necessaire
    const data = chunk.toString();
    // Transformer les donnees
    this.push(data.toUpperCase());
    callback();
  }

  // Optionnel: appele a la fin du stream
  _flush(callback) {
    callback();
  }
}

// Utiliser pipeline
await pipeline(
  createReadStream('input.txt'),
  new MyTransform(),
  createWriteStream('output.txt')
);
```
