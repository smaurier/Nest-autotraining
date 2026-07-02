# Lab 03 — Streamer un upload de médias TribuZen

> **Outcome :** à la fin, tu sais écrire un pipeline Node.js 22 qui traite un fichier volumineux sans le charger en mémoire — lecture, Transform de progression, compression gzip, écriture.
> **Vrai outil :** Node.js 22 (`node:stream`, `node:stream/promises`, `node:fs`, `node:zlib`) — zéro dépendance npm.
> **Feedback :** le coach valide en session — vérification que la mémoire RSS reste stable (< 50 Mo) pendant le pipeline.

## Énoncé

TribuZen reçoit des uploads de médias en production. L'objectif est d'écrire un script `pipeline.ts` qui :

1. Lit `input.bin` (20 Mo généré ci-dessous)
2. Mesure la progression octet par octet via un Transform passthrough
3. Compresse à la volée avec gzip
4. Écrit le résultat compressé dans `output.bin.gz`

Contrainte : la mémoire RSS du processus doit rester **sous 50 Mo** tout au long du pipeline.

**Setup — génère le fichier source (une seule fois) :**

```ts
// generate-input.ts
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

async function generate(): Promise<void> {
  async function* data() {
    for (let i = 0; i < 20 * 1024; i++) {
      yield Buffer.allocUnsafe(1024).fill(i % 256)
    }
  }
  await pipeline(Readable.from(data()), createWriteStream('input.bin'))
  console.log('input.bin généré (20 Mo)')
}

generate()
```

Lance avec : `npx tsx generate-input.ts`

## Étapes (en friction)

1. **Créer `pipeline.ts`** — importer `pipeline` depuis `node:stream/promises`, `createReadStream`/`createWriteStream`/`statSync` depuis `node:fs`, `createGzip` depuis `node:zlib`, `Transform` et `TransformCallback` depuis `node:stream`.

2. **Écrire `ProgressTransform`** — une classe `extends Transform` avec :
   - Un compteur privé `processed = 0`
   - `_transform(chunk, _enc, callback)` : incrémenter `processed`, calculer le %, afficher avec `process.stdout.write(\`\rTraitement : ${pct}%\`)`, passer le chunk intact avec `this.push(chunk)`, appeler `callback()`
   - `_flush(callback)` : afficher un saut de ligne `\n`, appeler `callback()`

3. **Assembler le pipeline** dans `async function main()` :
   - Récupérer la taille source avec `statSync('input.bin').size`
   - `await pipeline(createReadStream('input.bin'), new ProgressTransform(size), createGzip(), createWriteStream('output.bin.gz'))`
   - Envelopper dans `try/catch`

4. **Vérifier la mémoire** — après le `await pipeline(...)`, afficher `process.memoryUsage().rss` converti en Mo.

5. **Tester l'erreur** — remplacer `'input.bin'` par `'inexistant.bin'` : vérifier que le `catch` attrape l'erreur et qu'aucun stream ne fuite (pas de processus bloqué).

## Corrigé complet commenté

```ts
// pipeline.ts
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream, statSync } from 'node:fs'
import { createGzip } from 'node:zlib'
import { Transform, type TransformCallback } from 'node:stream'

// Transform passthrough : mesure la progression sans modifier les données
// "Passthrough" = this.push(chunk) identique à l'entrée
class ProgressTransform extends Transform {
  private processed = 0

  // total : taille en octets du fichier source pour calculer le pourcentage
  constructor(private readonly total: number) {
    super() // mode buffer par défaut — chunk est un Buffer
  }

  _transform(chunk: Buffer, _enc: string, callback: TransformCallback): void {
    this.processed += chunk.length

    // Calcul du pourcentage avec 1 décimale
    const pct = ((this.processed / this.total) * 100).toFixed(1)

    // \r revient en début de ligne — affiche la progression in-place
    // sans créer de nouvelles lignes à chaque chunk
    process.stdout.write(`\rTraitement : ${pct}%`)

    // Passer le chunk INTACT vers le prochain stream (createGzip)
    // Sans this.push(chunk), les données sont perdues — le fichier de sortie serait vide
    this.push(chunk)

    // callback() est OBLIGATOIRE — signale à Node.js que le chunk est traité
    // et que le prochain peut être demandé. Sans callback(), le pipeline se bloque
    // définitivement : il attend que le Transform soit "prêt" mais ce signal n'arrive jamais
    callback()
  }

  _flush(callback: TransformCallback): void {
    // _flush() est appelé quand le Readable source a émis tous ses chunks
    // et émis la fin (push(null)). C'est ici qu'on "vide" ce qui reste en mémoire.
    // ProgressTransform n'accumule rien — le saut de ligne est le seul travail restant.
    process.stdout.write('\n')

    // callback() dans _flush() est aussi obligatoire
    // Sans lui, le pipeline ne termine jamais (pas d'événement 'finish')
    callback()
  }
}

async function main(): Promise<void> {
  const src = 'input.bin'
  const dest = 'output.bin.gz'

  // statSync AVANT le pipeline — bloquant mais unique (une seule lecture de métadonnée)
  // La taille est nécessaire pour calculer le pourcentage dans ProgressTransform
  const { size } = statSync(src)
  console.log(`Source : ${(size / 1024 / 1024).toFixed(1)} Mo`)

  try {
    await pipeline(
      // 1. Readable : lit input.bin par chunks de 64 Ko (highWaterMark défaut)
      //    Chaque chunk est un Buffer de ~65 536 octets
      createReadStream(src),

      // 2. Transform : mesure la progression, passe les données intactes
      //    Reçoit des Buffers, émet des Buffers — mode buffer des deux côtés
      new ProgressTransform(size),

      // 3. Transform natif : compresse avec l'algorithme gzip (niveau 6 par défaut)
      //    createGzip() est lui-même un Transform stream de node:zlib
      createGzip(),

      // 4. Writable : écrit les données compressées dans output.bin.gz
      createWriteStream(dest),
    )
    // pipeline() retourne une Promise qui se résout quand le Writable final
    // a émis 'finish' — c'est-à-dire quand tout est écrit sur le disque

    // Vérification mémoire : RSS (Resident Set Size) = mémoire physique utilisée
    // Avec des streams, la RSS reste ~constante quelle que soit la taille du fichier
    const rss = process.memoryUsage().rss
    console.log(`Mémoire RSS : ${(rss / 1024 / 1024).toFixed(1)} Mo`)
    console.log(`Pipeline OK : ${src} → ${dest}`)
  } catch (err) {
    // pipeline() rejette si n'importe quel stream plante (lecture, transform, écriture)
    // Tous les streams sont automatiquement destroy()és — pas de fuite
    console.error('Pipeline KO :', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
```

Lance avec : `npx tsx pipeline.ts`

Sortie attendue :
```
Source : 20.0 Mo
Traitement : 100.0%
Mémoire RSS : 38.4 Mo
Pipeline OK : input.bin → output.bin.gz
```

La RSS reste sous 50 Mo pour un fichier de 20 Mo — le pipeline n'a jamais chargé plus de ~64 Ko en mémoire à la fois.

## Variante J+30 (fading)

Même contrainte de mémoire (< 50 Mo), complexité ajoutée : **sans réutiliser `ProgressTransform` tel quel**, implémenter en 30 min le pipeline suivant :

- Lire `input.bin` en mode texte UTF-8
- Découper en lignes (gérer les chunks qui coupent une ligne au milieu — buffer résiduel dans `_transform`)
- Convertir chaque ligne en objet `{ index: number, data: string }` en mode objet
- Sérialiser chaque objet en JSON → NDJSON (une ligne par objet)
- Écrire `output.ndjson`
- Afficher le **nombre de lignes traitées** (pas un pourcentage de taille) en fin de pipeline

Contrainte supplémentaire : utiliser `readableObjectMode`/`writableObjectMode` séparément pour chaque Transform — ne pas mettre `objectMode: true`.

## Application TribuZen

Porter le pipeline dans `smaurier/tribuzen` :

**Étape 1 — remplacer `createReadStream` par la requête HTTP.**
`IncomingMessage` (l'objet `req` dans un contrôleur NestJS) est un Readable Stream. On le passe directement en premier argument de `pipeline()` :

```ts
// media.service.ts (NestJS)
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'
import type { IncomingMessage } from 'node:http'

async function uploadMedia(req: IncomingMessage, mediaId: string): Promise<void> {
  await pipeline(
    req,                                               // Readable (requête HTTP)
    createGzip(),                                      // compresse à la volée
    createWriteStream(`/uploads/${mediaId}.mp4.gz`),  // écrit sur disque
  )
}
```

**Étape 2 — accéder au stream brut dans NestJS.**
Par défaut, NestJS parse le body avant que le contrôleur le reçoive. Pour accéder au stream brut, utiliser `@Req() req: Request` avec `rawBody` activé dans `NestFactory.create`, ou créer un intercepteur `PassThrough` qui capte le stream avant le body parser.

**Étape 3 — commit cible.**
`feat(media): stream upload with gzip pipeline`

```
tribuzen/
  src/
    media/
      media.service.ts      ← pipeline req → gzip → writeStream
      media.controller.ts   ← @Post('upload') + @Req() req
```
