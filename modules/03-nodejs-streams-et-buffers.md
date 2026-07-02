---
titre: Node.js streams et buffers
cours: 09-nestjs
notions: [Buffer et données binaires, streams readable et writable, duplex et transform, pipe et pipeline, backpressure, mode objet, consommation d'un stream, cas d'usage fichiers volumineux]
outcomes: [manipuler des Buffers, lire/écrire avec des streams, chaîner des streams avec pipeline, comprendre et gérer la backpressure]
prerequis: [02-nodejs-modules-et-fs]
next: 04-nodejs-serveur-http
libs: [{ name: node, version: "22" }]
tribuzen: streamer l'upload/download des médias TribuZen sans charger tout en mémoire
last-reviewed: 2026-07
---

# Node.js streams et buffers

> **Outcomes — tu sauras FAIRE :** manipuler des Buffers, lire et écrire avec des streams, chaîner des streams avec `pipeline`, comprendre et gérer la backpressure.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, un membre de famille upload une vidéo de vacances de 80 Mo. Voici ce qui se passe avec l'approche naïve :

```ts
// ❌ Approche naïve — charge TOUT en mémoire
import { readFile, writeFile } from 'node:fs/promises'

const data = await readFile('vacances.mp4')       // 80 Mo chargés en RAM
const compressed = compress(data)                  // encore 80 Mo en RAM
await writeFile('vacances.mp4.gz', compressed)     // écriture depuis la RAM
// Pic mémoire : ~160 Mo pour un seul upload
```

Avec 100 uploads simultanés, c'est 16 Go de RAM. Node.js crashe.

La question : comment traiter un fichier arbitrairement grand avec une consommation mémoire **constante** (~64 Ko par stream), quelle que soit la taille du fichier ?

Réponse : les **streams**. Ce module te donne les outils pour l'implémenter.

## 2. Théorie complète, concise

### 2.1 Buffer — données binaires en mémoire

Un `Buffer` est une zone de mémoire de taille fixe qui stocke des octets bruts. Il ne peut pas grandir après création.

```ts
// Buffer.from — depuis une donnée existante
const a = Buffer.from('TribuZen', 'utf-8')       // 8 octets
const b = Buffer.from('dHJpYnV6ZW4=', 'base64') // depuis du base64
const c = Buffer.from([0x54, 0x72, 0x69])         // depuis un tableau d'octets

// Buffer.alloc — buffer initialisé à zéro (sûr par défaut)
const d = Buffer.alloc(16)    // 16 octets, tous à 0x00

// Buffer.allocUnsafe — plus rapide, contenu imprévisible
// Utiliser uniquement si tu remplis IMMÉDIATEMENT tout le buffer
const e = Buffer.allocUnsafe(16)

// Conversion
console.log(a.toString('utf-8'))    // 'TribuZen'
console.log(a.toString('base64'))   // 'VHJpYnVaZW4='
console.log(a.toString('hex'))      // '5472696275...'
console.log(a.length)               // 8 (octets, pas caractères Unicode)

// Concaténer (ne jamais faire buf1 + buf2 — crée des copies inutiles)
const merged = Buffer.concat([a, Buffer.from(' rocks')])
console.log(merged.toString())      // 'TribuZen rocks'
```

Encodages courants :

| Encodage | Usage |
|----------|-------|
| `utf-8` (défaut) | Texte, JSON, HTML |
| `base64` | Envoi d'images en JSON, tokens JWT |
| `hex` | Hashes, clés crypto |
| `binary` / `latin1` | Legacy uniquement |

### 2.2 Readable stream — lire une source de données

Un Readable a deux modes :

| Mode | Déclenchement | Usage |
|------|---------------|-------|
| **Flowing** | `.on('data', cb)`, `.pipe()`, `for await...of` | Le plus courant |
| **Paused** | `.read()` dans `'readable'` | Contrôle manuel du rythme |

```ts
import { createReadStream } from 'node:fs'

// Mode flowing — événements
const rs = createReadStream('vacances.mp4', {
  highWaterMark: 64 * 1024, // taille des chunks : 64 Ko (défaut)
})

rs.on('data', (chunk: Buffer) => console.log(`Chunk : ${chunk.length} octets`))
rs.on('end', () => console.log('Lecture terminée'))
rs.on('error', (err) => console.error(err.message))
```

**Consommation moderne — `for await...of`** (Node.js 12+) :

```ts
import { createReadStream } from 'node:fs'

// for await...of — lisible comme du code synchrone
// Une erreur de stream lève dans la boucle → gérer avec try/catch
try {
  const rs = createReadStream('vacances.mp4')
  for await (const chunk of rs) {
    process.stdout.write(`Reçu ${(chunk as Buffer).length} o\n`)
  }
} catch (err) {
  console.error('Erreur stream :', err)
}
```

**`Readable.from`** — créer un Readable depuis un itérable ou générateur async :

```ts
import { Readable } from 'node:stream'

// Depuis un tableau (utile dans les tests)
const r1 = Readable.from(['chunk1', 'chunk2', 'chunk3'])

// Depuis un générateur async (simuler une source réseau ou paginée)
async function* generate() {
  for (let i = 0; i < 5; i++) {
    yield `Ligne ${i}\n`
  }
}
const r2 = Readable.from(generate())
```

### 2.3 Writable stream — écrire vers une destination

```ts
import { createWriteStream } from 'node:fs'

const ws = createWriteStream('output.mp4.gz')

// write() retourne false si le buffer interne est plein (backpressure)
const canContinue: boolean = ws.write(chunk)

ws.on('drain', () => {
  // Le buffer s'est vidé — reprendre l'écriture
})

ws.end()  // signale qu'il n'y a plus de données à écrire
ws.on('finish', () => console.log('Écriture terminée'))
ws.on('error', (err) => console.error(err.message))
```

### 2.4 Transform et Duplex

**Transform** — reçoit des données, les transforme, les passe au stream suivant :

```ts
import { Transform, type TransformCallback } from 'node:stream'

class UppercaseTransform extends Transform {
  _transform(chunk: Buffer, _enc: string, callback: TransformCallback): void {
    // this.push() envoie les données transformées côté Readable
    this.push(chunk.toString().toUpperCase())
    // callback() est OBLIGATOIRE — signale que le chunk est traité
    // Sans callback(), le pipeline se bloque
    callback()
  }

  _flush(callback: TransformCallback): void {
    // Appelé quand le stream source est terminé
    // Émettre les données restantes en mémoire (ex. dernier chunk incomplet)
    callback()
  }
}
```

**Duplex** — Readable et Writable **indépendants** (les deux côtés ne partagent pas les données) :

```ts
import { Duplex } from 'node:stream'

// En pratique : tu UTILISES des Duplex (net.Socket, WebSocket),
// tu n'en ÉCRIS pas souvent toi-même.
// Différence clé avec Transform :
//   Transform = ce qu'on écrit PASSE côté lecture après transformation
//   Duplex    = les deux côtés sont décorrélés — pas de passage automatique
const duplex = new Duplex({
  read() {
    this.push('données côté Readable')
    this.push(null) // fin du Readable
  },
  write(chunk, _enc, callback) {
    console.log('Reçu côté Writable :', chunk.toString())
    callback()
  },
})
```

### 2.5 pipe() vs pipeline()

**`pipe()`** — connecte un Readable à un Writable, **ne propage pas les erreurs** :

```ts
import { createReadStream, createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'

// ❌ Si createGzip() plante → descripteurs de fichiers fuient,
// les streams restent ouverts, fuite mémoire
createReadStream('in.mp4')
  .pipe(createGzip())
  .pipe(createWriteStream('in.mp4.gz'))
```

**`pipeline()`** (recommandé) — Promise, propagation d'erreurs, nettoyage automatique :

```ts
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'

// ✅ Si un stream plante → tous les autres sont destroy()és
// await pipeline(...) rejette avec l'erreur originale
await pipeline(
  createReadStream('vacances.mp4'),
  createGzip(),
  createWriteStream('vacances.mp4.gz'),
)
```

### 2.6 Backpressure

La **backpressure** est le mécanisme qui empêche un Readable rapide de submerger un Writable lent.

```
Readable ─── write() ──► Writable
               ↑
               write() retourne false → Readable.pause()
               'drain' émis          → Readable.resume()
```

`pipeline()` gère la backpressure automatiquement. Si tu écris manuellement :

```ts
import { createWriteStream } from 'node:fs'

const ws = createWriteStream('out.dat')

function writeWithBackpressure(chunk: Buffer, callback: () => void): void {
  // write() retourne false si le buffer interne (highWaterMark) est plein
  if (!ws.write(chunk)) {
    // Attendre que le buffer se vide avant de continuer
    ws.once('drain', callback)
  } else {
    // Buffer pas encore plein — continuer immédiatement
    // process.nextTick() évite un stack overflow sur de longues séries
    process.nextTick(callback)
  }
}
```

**`highWaterMark`** — seuil d'activation de la backpressure :

```ts
// Readable : accumuler jusqu'à X octets avant pause
const rs = createReadStream('in.dat', { highWaterMark: 64 * 1024 })  // 64 Ko (défaut)

// Writable : write() retourne false quand le buffer dépasse X octets
const ws = createWriteStream('out.dat', { highWaterMark: 16 * 1024 }) // 16 Ko (défaut)
```

### 2.7 Mode objet

Par défaut, les streams transportent des `Buffer` ou `string`. Avec `objectMode: true`, ils transportent **n'importe quel objet JavaScript** (sauf `null`) :

```ts
import { Transform, type TransformCallback } from 'node:stream'

// Transform qui reçoit des strings (lignes CSV) et émet des objets JS
class CsvToObject extends Transform {
  private headers: string[] | null = null

  constructor() {
    // readableObjectMode : le côté sortie émet des objets
    // writableObjectMode : le côté entrée reçoit des strings
    // (Ne pas mettre objectMode: true — activerait les deux côtés,
    //  ce qui changerait le highWaterMark à 16 objets côté entrée aussi)
    super({ readableObjectMode: true, writableObjectMode: true })
  }

  _transform(line: string, _enc: string, callback: TransformCallback): void {
    const fields = line.split(',').map((f) => f.trim())
    if (!this.headers) {
      this.headers = fields
    } else {
      // this.push() émet un objet JavaScript, pas un Buffer
      this.push(Object.fromEntries(this.headers.map((h, i) => [h, fields[i]])))
    }
    callback()
  }
}
```

**`highWaterMark` en mode objet** = nombre d'objets dans le buffer (pas d'octets). Défaut : 16 objets.

## 3. Worked examples

### Exemple A — pipeline gzip avec progression (fichier volumineux)

```ts
// compress-with-progress.ts
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream, statSync } from 'node:fs'
import { createGzip } from 'node:zlib'
import { Transform, type TransformCallback } from 'node:stream'

// Transform passthrough qui mesure la progression sans modifier les données
class ProgressTransform extends Transform {
  private processed = 0

  constructor(private readonly total: number) {
    super()  // mode buffer par défaut — chunk est un Buffer
  }

  _transform(chunk: Buffer, _enc: string, callback: TransformCallback): void {
    this.processed += chunk.length
    const pct = ((this.processed / this.total) * 100).toFixed(1)
    // \r revient en début de ligne — progression in-place
    process.stdout.write(`\rCompression : ${pct}%`)
    // Passer le chunk INTACT — sans this.push(chunk), les données sont perdues
    this.push(chunk)
    callback()
  }

  _flush(callback: TransformCallback): void {
    process.stdout.write('\n')
    callback()
  }
}

async function compressFile(src: string, dest: string): Promise<void> {
  const { size } = statSync(src)   // statSync : synchrone, ponctuel, acceptable ici

  await pipeline(
    createReadStream(src),
    new ProgressTransform(size),   // mesure, passe les données intactes
    createGzip(),                  // compresse (Transform natif)
    createWriteStream(dest),
  )
  console.log(`Compressé : ${src} → ${dest}`)
}

await compressFile('vacances.mp4', 'vacances.mp4.gz')
```

Pas-à-pas :
1. `ProgressTransform` est un Transform passthrough — `push(chunk)` sans le modifier. La progression est un **effet de bord** de la transformation.
2. `pipeline` enchaîne 4 streams. Si `createGzip()` plante, tous sont `destroy()`és — pas de fuite de descripteur de fichier.
3. `statSync` est appelé **avant** le pipeline (une seule fois) — le coût I/O bloquant est négligeable comparé au pipeline lui-même.

### Exemple B — pipeline CSV → NDJSON en mode objet

```ts
// csv-to-ndjson.ts
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform, type TransformCallback } from 'node:stream'

// Étape 1 — découpe le flux en lignes (buffer → object mode)
class LineSplitter extends Transform {
  private buffer = ''

  constructor() {
    super({ readableObjectMode: true }) // sortie : strings
  }

  _transform(chunk: Buffer, _enc: string, callback: TransformCallback): void {
    const data = this.buffer + chunk.toString()
    const lines = data.split('\n')
    this.buffer = lines.pop() ?? ''        // dernière ligne peut être incomplète
    for (const line of lines) {
      if (line.trim()) this.push(line)     // émet des strings
    }
    callback()
  }

  _flush(callback: TransformCallback): void {
    if (this.buffer.trim()) this.push(this.buffer)
    callback()
  }
}

// Étape 2 — string CSV → objet JS (object mode → object mode)
class CsvParser extends Transform {
  private headers: string[] | null = null

  constructor() {
    super({ readableObjectMode: true, writableObjectMode: true })
  }

  _transform(line: string, _enc: string, callback: TransformCallback): void {
    const fields = line.split(',').map((f) => f.trim())
    if (!this.headers) {
      this.headers = fields
    } else {
      this.push(Object.fromEntries(this.headers.map((h, i) => [h, fields[i]])))
    }
    callback()
  }
}

// Étape 3 — objet JS → ligne JSON (object mode → buffer mode)
class JsonStringify extends Transform {
  constructor() {
    super({ writableObjectMode: true }) // entrée : objets JS, sortie : Buffer
  }

  _transform(obj: unknown, _enc: string, callback: TransformCallback): void {
    this.push(JSON.stringify(obj) + '\n') // NDJSON — une ligne par objet
    callback()
  }
}

await pipeline(
  createReadStream('membres.csv', 'utf-8'),
  new LineSplitter(),
  new CsvParser(),
  new JsonStringify(),
  createWriteStream('membres.ndjson'),
)
```

Pas-à-pas :
1. `LineSplitter` passe de mode buffer à mode objet : `readableObjectMode: true` uniquement côté sortie. Le `buffer` résiduel gère les chunks qui coupent une ligne au milieu.
2. `CsvParser` est entièrement en mode objet — `highWaterMark` = 16 objets, pas 64 Ko.
3. `JsonStringify` repasse en mode buffer pour l'écriture fichier — `writableObjectMode: true` côté entrée uniquement.
4. Un seul `await pipeline(...)`, une seule gestion d'erreur pour les 5 streams.

## 4. Pièges & misconceptions

**`pipe()` n'est pas `pipeline()`.** `pipe()` ne propage pas les erreurs entre streams. Si un Transform intermédiaire plante, le Readable reste en mode flowing, le Writable reste ouvert. Résultat : fuite de descripteurs de fichiers et de mémoire. *Correct* : toujours `pipeline()` depuis `node:stream/promises`.

**`Buffer.allocUnsafe` contient des données résiduelles.** Le contenu d'un buffer non initialisé est imprévisible — il peut contenir des mots de passe ou tokens d'une autre zone mémoire du même processus. *Correct* : `Buffer.alloc(n)` par défaut ; `allocUnsafe` uniquement si tu écrases **immédiatement** tout le contenu (ex. remplissage depuis une source externe).

**`write()` ignoré → accumulation silencieuse.** Si tu n'inspectes pas la valeur de retour de `ws.write(chunk)` et que tu continues à écrire, les chunks s'accumulent dans le buffer interne sans limite mémoire. *Correct* : vérifier que `write()` retourne `false` → attendre `'drain'` avant de reprendre.

**`objectMode: true` vs `readableObjectMode`/`writableObjectMode`.** `objectMode: true` active le mode objet des **deux** côtés d'un Transform — ce qui fait passer `highWaterMark` à 16 objets des deux côtés. Quand tu chaînes des streams à modes différents (buffer → object → buffer), utiliser les options séparées pour contrôler chaque côté. *Confusion* : mettre `objectMode: true` sur un Transform qui reçoit des Buffers → backpressure calculée sur 16 objets, pas 64 Ko.

**`for await...of` sans `try/catch`.** Un Readable en erreur rejette l'itération async. Sans `try/catch`, le rejet est non géré et fait planter le processus. *Correct* : toujours envelopper `for await...of` dans un `try/catch`.

**`callback()` oublié dans `_transform` ou `_flush`.** Sans `callback()`, le pipeline se bloque : le prochain chunk n'est jamais demandé. Sans `callback()` dans `_flush()`, le pipeline n'atteint jamais le `finish`. *Correct* : appeler `callback()` dans **tous les chemins** d'exécution de `_transform` et `_flush`.

## 5. Ancrage TribuZen

Couche fil-rouge : **streamer l'upload/download des médias TribuZen sans charger tout en mémoire** (`smaurier/tribuzen`).

Dans TribuZen, les médias (photos, vidéos de vacances) peuvent dépasser 500 Mo. Trois intégrations directes :

**Upload de média.** La requête HTTP entrante est un Readable Stream (`IncomingMessage`). On peut la piper directement vers le stockage sans passer par la mémoire :

```ts
// media.service.ts — aperçu NestJS
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

**Download avec Range requests.** `createReadStream(path, { start, end })` lit uniquement le segment demandé — idéal pour les lecteurs vidéo qui font des requêtes `Range: bytes=0-1048576`. Mémoire constante quelle que soit la position dans le fichier.

**Transformation de vignettes.** Un Transform stream peut redimensionner ou recadrer les images à la volée entre le Readable (fichier source) et le Writable (fichier destination), sans jamais charger l'image entière.

Fichiers cibles :
```
tribuzen/
  src/
    media/
      media.service.ts      ← pipeline upload → storage + compress
      media.controller.ts   ← req (Readable) → pipeline
```

## 6. Points clés

1. `Buffer.alloc(n)` = mémoire initialisée à zéro (sûr) ; `allocUnsafe` = données résiduelles possibles — n'utiliser que si le contenu est immédiatement écrasé.
2. `Buffer.length` = nombre d'**octets**, pas de caractères Unicode (un emoji UTF-8 = 4 octets).
3. Readable en mode flowing : `on('data')`, `pipe()`, `for await...of`. En mode paused : `.read()` dans `'readable'`.
4. `for await...of` sur un Readable est la syntaxe moderne — lisible, rejette en cas d'erreur stream. Toujours dans un `try/catch`.
5. `write(chunk)` retourne `false` quand le buffer interne dépasse `highWaterMark` → écouter `'drain'` avant de reprendre.
6. `pipeline()` (depuis `node:stream/promises`) : Promise, propagation d'erreurs, `destroy()` automatique de tous les streams. Toujours préférer à `.pipe()`.
7. `objectMode: true` = le stream transporte des objets JS (highWaterMark = 16 objets). Utiliser `readableObjectMode`/`writableObjectMode` pour activer le mode objet sur un seul côté d'un Transform.
8. Cas d'usage streams : fichiers > quelques Mo, envoi HTTP progressif, transformation ligne par ligne, compression à la volée, upload de médias.

## 7. Seeds Anki

```
Différence entre Buffer.alloc() et Buffer.allocUnsafe() ?|alloc() initialise tous les octets à 0 — sûr pour stocker des données sensibles. allocUnsafe() ne les initialise pas — plus rapide mais peut contenir des données résiduelles du processus (mots de passe, tokens). Utiliser allocUnsafe() uniquement si on écrase immédiatement tout le contenu.
Pourquoi pipe() est-il dangereux par rapport à pipeline() ?|pipe() ne propage pas les erreurs entre streams — si un Transform intermédiaire plante, les autres restent ouverts (fuite de descripteurs et mémoire). pipeline() depuis node:stream/promises propage les erreurs et destroy()ise tous les streams automatiquement.
Qu'est-ce que la backpressure dans les streams Node.js ?|Mécanisme qui empêche un Readable rapide de submerger un Writable lent. write() retourne false quand le buffer interne dépasse highWaterMark — le Readable doit se mettre en pause et attendre l'événement drain avant de reprendre.
Que signifie objectMode: true sur un Transform ?|Le stream transporte des objets JS au lieu de Buffers/strings. Le highWaterMark passe de 64 Ko à 16 objets. Utiliser readableObjectMode/writableObjectMode pour activer le mode objet sur un seul côté du Transform.
Comment consommer un Readable Stream de façon moderne ?|for await...of dans un bloc try/catch — syntaxe lisible, lève si le stream est en erreur. Alternative : Readable.from(iterable) pour créer un Readable depuis un tableau ou générateur async.
Quel est le rôle de _flush() dans un Transform Stream ?|Appelé quand le stream source (côté Writable) est terminé. Permet d'émettre les données restantes en mémoire (ex. dernière ligne incomplète d'un parseur CSV). Appeler callback() pour signaler la fin — sans cela, le pipeline ne termine jamais.
Quand utiliser createReadStream plutôt que readFile ?|readFile charge tout en mémoire — adapté aux petits fichiers de config (JSON, .env). createReadStream lit par chunks (highWaterMark = 64 Ko par défaut) — mémoire constante. Règle : si la taille est inconnue ou peut dépasser quelques Mo, utiliser createReadStream.
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-03-streams/README.md`. Tu y implémentes un pipeline complet qui streame un fichier de 20 Mo — lecture, Transform de progression, compression gzip, écriture — avec vérification que la mémoire RSS reste sous 50 Mo. Corrigé commenté ligne à ligne + variante J+30.
