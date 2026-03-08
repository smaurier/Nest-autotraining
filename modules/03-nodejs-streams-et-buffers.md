# Module 03 — Node.js — Streams & Buffers

> **Objectif** : Comprendre les Buffers pour manipuler des donnees binaires, maitriser les 4 types de Streams (Readable, Writable, Transform, Duplex), et savoir utiliser pipe/pipeline pour traiter des flux de donnees efficacement.
>
> **Difficulte** : ⭐⭐ (intermediaire)

---

## 1. Les Buffers — Manipuler des donnees binaires

### 1.1 Qu'est-ce qu'un Buffer

En JavaScript navigateur, tu travailles avec des strings, des nombres et des objets. Mais dans Node.js, tu dois souvent manipuler des **donnees binaires** : fichiers, images, donnees reseau, flux audio/video. Le **Buffer** est la structure de donnees de Node.js pour stocker des donnees binaires brutes.

> **Analogie** : Un Buffer, c'est comme un casier de consigne a la gare. Chaque case (octet) contient un nombre entre 0 et 255. Le casier a une taille fixe — tu ne peux pas ajouter de cases apres sa creation. Tu peux lire et ecrire dans chaque case individuellement.

```javascript
// Un Buffer est une zone de memoire brute contenant des octets
const buf = Buffer.from('Bonjour');
console.log(buf);
// <Buffer 42 6f 6e 6a 6f 75 72>
// Chaque paire hexadecimale = 1 octet
// 42 = 'B', 6f = 'o', 6e = 'n', 6a = 'j', 6f = 'o', 75 = 'u', 72 = 'r'

console.log(buf.length);     // 7 (7 octets)
console.log(buf.toString());  // 'Bonjour'
```

### 1.2 Creer des Buffers

```javascript
// === Buffer.from — Creer a partir de donnees existantes ===

// A partir d'une string
const buf1 = Buffer.from('Hello World', 'utf-8');
console.log(buf1); // <Buffer 48 65 6c 6c 6f 20 57 6f 72 6c 64>

// A partir d'un tableau d'octets
const buf2 = Buffer.from([72, 101, 108, 108, 111]);
console.log(buf2.toString()); // 'Hello'

// A partir d'une string en base64
const buf3 = Buffer.from('SGVsbG8gV29ybGQ=', 'base64');
console.log(buf3.toString()); // 'Hello World'

// A partir d'une string hexadecimale
const buf4 = Buffer.from('48656c6c6f', 'hex');
console.log(buf4.toString()); // 'Hello'

// === Buffer.alloc — Creer un buffer vide (initialise a 0) ===
const buf5 = Buffer.alloc(10); // 10 octets, tous a 0
console.log(buf5); // <Buffer 00 00 00 00 00 00 00 00 00 00>

// === Buffer.allocUnsafe — Creer un buffer vide (NON initialise) ===
// Plus rapide mais peut contenir des donnees residuelles en memoire
const buf6 = Buffer.allocUnsafe(10);
// DANGER : le contenu est imprevisible ! Utilise alloc() sauf si tu sais ce que tu fais
```

> **Piege classique** : N'utilise `Buffer.allocUnsafe()` que si tu vas immediatement ecrire dans tout le buffer. Sinon, des donnees sensibles (mots de passe, tokens) d'autres parties de la memoire pourraient fuiter. Utilise toujours `Buffer.alloc()` par defaut.

### 1.3 Encodages

| Encodage | Description | Utilisation |
|---|---|---|
| `utf-8` | Encodage Unicode variable (1-4 octets/caractere) | **Defaut** — texte, JSON, HTML |
| `ascii` | 7 bits, caracteres anglais uniquement | Protocoles basiques |
| `base64` | Representation texte de donnees binaires | Envoi d'images en JSON, tokens |
| `hex` | Representation hexadecimale | Hashes, cles cryptographiques |
| `binary` (latin1) | 1 octet par caractere | Legacy, deconseille |
| `utf-16le` | Unicode 16 bits little-endian | Fichiers Windows, BMP |

```javascript
const original = 'Bonjour le monde';

// Convertir entre encodages
const buf = Buffer.from(original, 'utf-8');

console.log(buf.toString('utf-8'));   // 'Bonjour le monde'
console.log(buf.toString('base64'));  // 'Qm9uam91ciBsZSBtb25kZQ=='
console.log(buf.toString('hex'));     // '426f6e6a6f7572206c65206d6f6e6465'

// Cas pratique : encoder une image en base64 pour l'envoyer en JSON
import { readFile } from 'fs/promises';

const imageBuffer = await readFile('photo.jpg');
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;
// Peut etre envoye dans un JSON ou utilise dans une balise <img>
```

### 1.4 Manipuler les Buffers

```javascript
const buf = Buffer.alloc(10);

// Ecrire dans un buffer
buf.write('Hi');
console.log(buf.toString()); // 'Hi' (suivi de caracteres nuls)

// Acceder a un octet individuel
buf[0] = 65; // 'A' en ASCII
console.log(buf.toString()); // 'Ai'

// Copier un buffer
const source = Buffer.from('ABCDEF');
const target = Buffer.alloc(10);
source.copy(target, 2, 0, 4); // copie src[0..4] dans target a partir de l'index 2
console.log(target.toString()); // '  ABCD    '

// Decouper un buffer (slice/subarray)
const original2 = Buffer.from('Hello World');
const slice = original2.subarray(0, 5);
console.log(slice.toString()); // 'Hello'

// Concatener des buffers
const part1 = Buffer.from('Hello');
const part2 = Buffer.from(' ');
const part3 = Buffer.from('World');
const combined = Buffer.concat([part1, part2, part3]);
console.log(combined.toString()); // 'Hello World'

// Comparer des buffers
const a = Buffer.from('ABC');
const b = Buffer.from('ABC');
const c = Buffer.from('ABD');
console.log(a.equals(b));    // true
console.log(a.equals(c));    // false
console.log(a.compare(c));   // -1 (a < c)
```

---

## 2. Les Streams — Traiter les donnees en flux

### 2.1 Pourquoi les Streams

Imagine que tu doives traiter un fichier de 2 Go. Deux approches :

```javascript
import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';

// APPROCHE 1 : Charger tout en memoire (MAUVAIS pour les gros fichiers)
const data = await readFile('fichier-2go.csv', 'utf-8');
// BOOM ! Ton processus Node.js utilise 2 Go de RAM
// Si le fichier fait 4 Go, tu depasses la limite du heap V8

// APPROCHE 2 : Lire par morceaux avec un Stream (BON)
const stream = createReadStream('fichier-2go.csv', 'utf-8');
stream.on('data', (chunk) => {
  // chunk = un morceau du fichier (~64 Ko)
  // Tu traites chaque morceau individuellement
  // La memoire utilisee reste constante (~64 Ko)
  console.log(`Recu ${chunk.length} caracteres`);
});
stream.on('end', () => {
  console.log('Lecture terminee');
});
```

> **Analogie** : Charger tout un fichier en memoire, c'est comme remplir une piscine avec un seul seau geant — il faut un seau aussi gros que la piscine. Les Streams, c'est comme utiliser un tuyau d'arrosage — l'eau coule en continu, tu n'as jamais besoin de stocker toute la piscine dans un seau.

### 2.2 Les 4 types de Streams

| Type | Description | Exemples natifs |
|---|---|---|
| **Readable** | Source de donnees (on lit depuis) | `fs.createReadStream`, `http.IncomingMessage`, `process.stdin` |
| **Writable** | Destination de donnees (on ecrit vers) | `fs.createWriteStream`, `http.ServerResponse`, `process.stdout` |
| **Transform** | Transforme les donnees en transit | `zlib.createGzip`, `crypto.createCipher` |
| **Duplex** | A la fois Readable et Writable | `net.Socket`, `crypto.createCipher` |

```
  Readable          Transform          Writable
  ┌──────┐          ┌──────┐          ┌──────┐
  │ data ├─────────▶│ data ├─────────▶│ data │
  │ data ├─────────▶│ data ├─────────▶│ data │
  │ data ├─────────▶│ data ├─────────▶│ data │
  └──────┘          └──────┘          └──────┘
  (fichier)         (gzip, ligne      (fichier,
                     par ligne)        reseau)
```

### 2.3 Readable Streams

Un Readable Stream a deux modes de lecture :

| Mode | Description | Comment activer |
|---|---|---|
| **Flowing** | Les donnees arrivent automatiquement via l'evenement `data` | `.on('data')`, `.pipe()`, `.resume()` |
| **Paused** | Tu demandes les donnees explicitement avec `.read()` | `.pause()`, `.read()` |

```javascript
import { createReadStream } from 'fs';

// === Mode Flowing (le plus courant) ===
const stream = createReadStream('fichier.txt', {
  encoding: 'utf-8',
  highWaterMark: 64 * 1024, // Taille de chaque chunk (64 Ko par defaut)
});

stream.on('data', (chunk) => {
  console.log(`Chunk de ${chunk.length} caracteres`);
});

stream.on('end', () => {
  console.log('Fin du fichier');
});

stream.on('error', (err) => {
  console.error('Erreur :', err.message);
});

// === Mode Paused (controle manuel) ===
const stream2 = createReadStream('fichier.txt', { encoding: 'utf-8' });

stream2.on('readable', () => {
  let chunk;
  while ((chunk = stream2.read()) !== null) {
    console.log(`Chunk lu : ${chunk.length} caracteres`);
  }
});
```

### 2.4 Writable Streams

```javascript
import { createWriteStream } from 'fs';

// Creer un stream d'ecriture
const ws = createWriteStream('sortie.txt', { encoding: 'utf-8' });

// Ecrire des donnees
ws.write('Premiere ligne\n');
ws.write('Deuxieme ligne\n');
ws.write('Troisieme ligne\n');

// Signaler la fin de l'ecriture
ws.end('Derniere ligne\n');

// Evenements
ws.on('finish', () => {
  console.log('Ecriture terminee');
});

ws.on('error', (err) => {
  console.error('Erreur d\'ecriture :', err.message);
});
```

#### L'evenement drain — Gestion de la pression

```javascript
import { createWriteStream } from 'fs';

const ws = createWriteStream('gros-fichier.txt');

function ecrireBeaucoup() {
  let i = 0;
  const max = 1000000;

  function ecrire() {
    let ok = true;
    while (i < max && ok) {
      const data = `Ligne ${i}\n`;
      // write() retourne false si le buffer interne est plein
      ok = ws.write(data);
      i++;
    }

    if (i < max) {
      // Le buffer est plein — attendre que drain soit emis
      ws.once('drain', ecrire);
    } else {
      ws.end();
    }
  }

  ecrire();
}

ecrireBeaucoup();
```

> **Piege classique** : Si tu ignores la valeur de retour de `ws.write()` et que tu continues a ecrire, les donnees s'accumulent en memoire (backpressure). Pour un million de lignes, ca peut causer un crash. Verifie toujours la valeur de retour et attend le `drain` si necessaire.

### 2.5 Transform Streams

Un Transform Stream recoit des donnees, les transforme, et les passe au stream suivant :

```javascript
import { Transform } from 'stream';

// Transform personnalise : mettre en majuscules
const uppercaseTransform = new Transform({
  transform(chunk, encoding, callback) {
    // chunk est un Buffer
    const uppercased = chunk.toString().toUpperCase();
    // this.push() envoie les donnees transformees en sortie
    this.push(uppercased);
    // callback() signale que le traitement est termine
    callback();
  },
});

// Utilisation : lire stdin, transformer, ecrire sur stdout
process.stdin
  .pipe(uppercaseTransform)
  .pipe(process.stdout);

// Tape du texte → il s'affiche en MAJUSCULES
```

```javascript
import { Transform } from 'stream';

// Transform : filtrer les lignes contenant un mot
class LineFilter extends Transform {
  constructor(keyword) {
    super({ objectMode: false });
    this.keyword = keyword;
    this.remaining = '';
  }

  _transform(chunk, encoding, callback) {
    const data = this.remaining + chunk.toString();
    const lines = data.split('\n');
    // La derniere "ligne" est peut-etre incomplete
    this.remaining = lines.pop();

    for (const line of lines) {
      if (line.includes(this.keyword)) {
        this.push(line + '\n');
      }
    }
    callback();
  }

  _flush(callback) {
    // Traiter le reste quand le stream source est termine
    if (this.remaining && this.remaining.includes(this.keyword)) {
      this.push(this.remaining + '\n');
    }
    callback();
  }
}

// Utilisation : filtrer les lignes contenant "ERROR" dans un fichier de log
import { createReadStream, createWriteStream } from 'fs';

createReadStream('app.log')
  .pipe(new LineFilter('ERROR'))
  .pipe(createWriteStream('errors-only.log'));
```

### 2.6 Duplex Streams

Un Duplex Stream est a la fois Readable et Writable, mais les deux cotes sont **independants** :

```javascript
import { Duplex } from 'stream';

const duplex = new Duplex({
  read(size) {
    // Generer des donnees pour le cote Readable
    this.push('Hello depuis le cote readable\n');
    this.push(null); // Signaler la fin
  },
  write(chunk, encoding, callback) {
    // Recevoir des donnees du cote Writable
    console.log('Recu :', chunk.toString());
    callback();
  },
});

// Le cote Readable peut etre lu
duplex.on('data', (chunk) => console.log('Lu :', chunk.toString()));

// Le cote Writable peut recevoir des donnees
duplex.write('Donnees envoyees au duplex\n');
duplex.end();
```

> **A retenir** : En pratique, tu n'ecris presque jamais de Duplex Streams toi-meme. Les exemples courants sont les sockets TCP (`net.Socket`) et les connexions WebSocket. L'important est de comprendre que les Duplex Streams existent et comment ils s'integrent dans le systeme de pipes.

---

## 3. pipe() et pipeline()

### 3.1 La methode pipe()

`pipe()` connecte un Readable a un Writable (avec gestion automatique de la backpressure) :

```javascript
import { createReadStream, createWriteStream } from 'fs';
import zlib from 'zlib';

// Copier un fichier
createReadStream('source.txt')
  .pipe(createWriteStream('copie.txt'));

// Compresser un fichier (chainer des pipes)
createReadStream('fichier.txt')
  .pipe(zlib.createGzip())           // Compresser
  .pipe(createWriteStream('fichier.txt.gz'));

// Decompresser
createReadStream('fichier.txt.gz')
  .pipe(zlib.createGunzip())         // Decompresser
  .pipe(createWriteStream('fichier-decompresse.txt'));
```

### 3.2 Le probleme de pipe() — Gestion des erreurs

```javascript
// PROBLEME : pipe() ne propage PAS les erreurs automatiquement
createReadStream('source.txt')
  .pipe(transform1)    // Si transform1 echoue, les streams suivants restent ouverts
  .pipe(transform2)    // Fuite memoire et descripteurs de fichiers !
  .pipe(createWriteStream('dest.txt'));

// Il faut ecouter 'error' sur CHAQUE stream — c'est fastidieux
```

### 3.3 La solution : pipeline() (recommande)

```javascript
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import zlib from 'zlib';

// pipeline() gere les erreurs ET nettoie tous les streams
async function compresser(source, destination) {
  try {
    await pipeline(
      createReadStream(source),
      zlib.createGzip(),
      createWriteStream(destination)
    );
    console.log('Compression terminee');
  } catch (err) {
    console.error('Erreur de compression :', err.message);
    // Tous les streams sont automatiquement nettoyes
  }
}

compresser('fichier.txt', 'fichier.txt.gz');
```

> **Bonne pratique** : Utilise TOUJOURS `pipeline()` (depuis `stream/promises`) plutot que `.pipe()`. C'est la methode moderne et sure pour chainer des streams. Elle gere les erreurs, nettoie les ressources et retourne une Promise.

---

## 4. La Backpressure expliquee

### 4.1 Qu'est-ce que la backpressure

La **backpressure** (contre-pression) est le mecanisme qui empeche un producteur rapide de submerger un consommateur lent.

```
  Producteur rapide          Consommateur lent
  (Readable)                 (Writable)
  ┌──────────┐               ┌──────────┐
  │ data ──▶ │ ─── pipe ──── │ ◀── data │
  │ data ──▶ │               │          │
  │ data ──▶ │  STOP! Buffer │          │
  │ ........ │  plein, pause │          │
  │          │               │ ◀── data │ (traitement lent)
  │ data ──▶ │  RESUME!      │          │
  │ data ──▶ │  Buffer vide  │          │
  └──────────┘               └──────────┘
```

> **Analogie** : La backpressure, c'est comme une file d'attente au restaurant. Si la cuisine est debordee (Writable lent), le serveur (pipe) arrete de prendre de nouvelles commandes (pause le Readable) jusqu'a ce que la cuisine ait rattrape son retard (evenement drain).

### 4.2 Comment ca fonctionne internement

```javascript
// pipe() fait essentiellement ceci en interne :
readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    // Le buffer du writable est plein
    readable.pause(); // Arrete de lire
  }
});

writable.on('drain', () => {
  // Le buffer du writable s'est vide
  readable.resume(); // Reprend la lecture
});

readable.on('end', () => {
  writable.end(); // Signale la fin
});
```

### 4.3 Le highWaterMark

Le `highWaterMark` est la taille du buffer interne de chaque stream (en octets). C'est le seuil a partir duquel la backpressure s'active :

```javascript
import { createReadStream, createWriteStream } from 'fs';

// Buffer de 16 Ko pour le readable (defaut : 64 Ko)
const reader = createReadStream('gros-fichier.dat', {
  highWaterMark: 16 * 1024,
});

// Buffer de 16 Ko pour le writable (defaut : 16 Ko)
const writer = createWriteStream('copie.dat', {
  highWaterMark: 16 * 1024,
});

reader.pipe(writer);
```

---

## 5. Exemples pratiques

### 5.1 Copie de fichier avec progression

```javascript
import { createReadStream, createWriteStream, statSync } from 'fs';

function copyWithProgress(source, destination) {
  const stats = statSync(source);
  const totalSize = stats.size;
  let copiedSize = 0;

  const reader = createReadStream(source);
  const writer = createWriteStream(destination);

  reader.on('data', (chunk) => {
    copiedSize += chunk.length;
    const percent = ((copiedSize / totalSize) * 100).toFixed(1);
    process.stdout.write(`\rProgression : ${percent}%`);
  });

  reader.pipe(writer);

  writer.on('finish', () => {
    console.log('\nCopie terminee !');
  });

  reader.on('error', (err) => console.error('Erreur lecture :', err.message));
  writer.on('error', (err) => console.error('Erreur ecriture :', err.message));
}

copyWithProgress('video.mp4', 'video-copie.mp4');
```

### 5.2 Traitement CSV ligne par ligne

```javascript
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

// Transform qui separe le flux en lignes
class LineSplitter extends Transform {
  constructor() {
    super({ objectMode: true });
    this.remaining = '';
  }

  _transform(chunk, encoding, callback) {
    const data = this.remaining + chunk.toString();
    const lines = data.split('\n');
    this.remaining = lines.pop(); // Garder la derniere ligne incomplete

    for (const line of lines) {
      if (line.trim()) {
        this.push(line);
      }
    }
    callback();
  }

  _flush(callback) {
    if (this.remaining.trim()) {
      this.push(this.remaining);
    }
    callback();
  }
}

// Transform qui parse une ligne CSV en objet
class CsvParser extends Transform {
  constructor() {
    super({ objectMode: true });
    this.headers = null;
  }

  _transform(line, encoding, callback) {
    const fields = line.split(',').map(f => f.trim());

    if (!this.headers) {
      this.headers = fields;
    } else {
      const obj = {};
      this.headers.forEach((header, i) => {
        obj[header] = fields[i];
      });
      this.push(obj);
    }
    callback();
  }
}

// Transform qui filtre et formate
class UserFormatter extends Transform {
  constructor(minAge) {
    super({ objectMode: true, writableObjectMode: true });
    this.minAge = minAge;
  }

  _transform(user, encoding, callback) {
    if (parseInt(user.age) >= this.minAge) {
      this.push(`${user.nom} (${user.age} ans) — ${user.email}\n`);
    }
    callback();
  }
}

// Pipeline complet : lire CSV → parser → filtrer → ecrire
await pipeline(
  createReadStream('users.csv', 'utf-8'),
  new LineSplitter(),
  new CsvParser(),
  new UserFormatter(25),
  process.stdout,
);
```

### 5.3 Serveur HTTP avec streaming

```javascript
import http from 'http';
import { createReadStream, statSync } from 'fs';
import path from 'path';

const server = http.createServer((req, res) => {
  if (req.url === '/video') {
    const videoPath = 'video.mp4';
    const stats = statSync(videoPath);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stats.size,
    });

    // Streamer le fichier directement dans la reponse HTTP
    // Le navigateur commence a lire avant que le fichier entier soit envoye
    createReadStream(videoPath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Accede a /video pour le stream video');
  }
});

server.listen(3000, () => {
  console.log('Serveur demarre sur http://localhost:3000');
});
```

### 5.4 Compression a la volee

```javascript
import http from 'http';
import { createReadStream } from 'fs';
import zlib from 'zlib';

const server = http.createServer((req, res) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const raw = createReadStream('gros-fichier.json');

  if (acceptEncoding.includes('gzip')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    });
    raw.pipe(zlib.createGzip()).pipe(res);
  } else if (acceptEncoding.includes('deflate')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Encoding': 'deflate',
    });
    raw.pipe(zlib.createDeflate()).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    raw.pipe(res);
  }
});

server.listen(3000);
```

---

## 6. Quand utiliser les Streams vs charger en memoire

| Critere | Charger en memoire (`readFile`) | Streams (`createReadStream`) |
|---|---|---|
| **Taille du fichier** | Petit (< 50 Mo) | Grand (> 50 Mo) |
| **Latence premier octet** | Elevee (tout charger d'abord) | Faible (commence immediatement) |
| **Memoire utilisee** | Proportionnelle a la taille du fichier | Constante (~64 Ko par stream) |
| **Complexite du code** | Simple | Plus complexe |
| **Traitement ligne par ligne** | Charger tout, split, iterer | Stream + Transform |
| **Envoi HTTP** | Doit tout charger avant d'envoyer | Stream direct (reponse progressive) |
| **Transformation** | Charger, transformer, sauvegarder | Transform stream (memoire constante) |

> **Bonne pratique** : En regle generale, si tu ne connais pas la taille du fichier a l'avance ou s'il peut depasser quelques Mo, utilise des Streams. Pour les fichiers de configuration (JSON, .env), `readFile` est parfaitement adapte.

---

## 7. Les Streams dans les modules natifs

Les Streams sont partout dans Node.js :

| Module | Readable | Writable |
|---|---|---|
| **fs** | `createReadStream()` | `createWriteStream()` |
| **http** | `IncomingMessage` (req) | `ServerResponse` (res) |
| **net** | `Socket` (Duplex) | `Socket` (Duplex) |
| **process** | `process.stdin` | `process.stdout`, `process.stderr` |
| **zlib** | | Transform (gzip, deflate) |
| **crypto** | | Transform (cipher, hash) |
| **child_process** | `child.stdout`, `child.stderr` | `child.stdin` |

```javascript
// process.stdin est un Readable Stream
// process.stdout est un Writable Stream

// Pipe stdin vers stdout (echo)
process.stdin.pipe(process.stdout);

// Pipe stdin vers un fichier
import { createWriteStream } from 'fs';
process.stdin.pipe(createWriteStream('input-capture.txt'));
```

---

## 8. Streams modernes avec les iterateurs asynchrones

Depuis Node.js 10+, les Readable Streams sont des **iterables asynchrones** :

```javascript
import { createReadStream } from 'fs';

// Ancienne facon (evenements)
const stream = createReadStream('fichier.txt', 'utf-8');
stream.on('data', (chunk) => { /* ... */ });
stream.on('end', () => { /* ... */ });

// Nouvelle facon (for await...of) — plus lisible !
const stream2 = createReadStream('fichier.txt', 'utf-8');
for await (const chunk of stream2) {
  console.log(`Chunk : ${chunk.length} caracteres`);
}
console.log('Fin du fichier');
```

```javascript
// Creer un Readable a partir d'un iterable
import { Readable } from 'stream';

// A partir d'un generateur async
async function* generateNumbers() {
  for (let i = 0; i < 10; i++) {
    yield `Nombre ${i}\n`;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const readable = Readable.from(generateNumbers());
readable.pipe(process.stdout);

// A partir d'un tableau
const readable2 = Readable.from(['Hello', ' ', 'World', '\n']);
readable2.pipe(process.stdout);
```

---

## 9. Exercices pratiques

### Exercice 1 — Compter les mots d'un fichier

Ecris un programme qui utilise des streams pour compter le nombre de mots dans un gros fichier texte sans le charger entierement en memoire.

### Exercice 2 — Crypter un fichier

Utilise `crypto.createCipheriv()` et `pipeline()` pour crypter un fichier, puis decrypte-le.

### Exercice 3 — Serveur de fichiers statiques avec streaming

Ecris un serveur HTTP qui sert des fichiers statiques en utilisant des streams (avec gestion du Content-Type selon l'extension).

### Exercice 4 — Transform Stream : Compteur de lignes

Cree un Transform Stream qui ajoute un numero de ligne au debut de chaque ligne.

```javascript
// Resultat attendu :
// 1: Premiere ligne
// 2: Deuxieme ligne
// 3: Troisieme ligne
```

---

## 10. Resume — Les concepts cles

| Concept | Definition |
|---|---|
| **Buffer** | Zone de memoire pour stocker des donnees binaires brutes |
| **Readable Stream** | Source de donnees (on lit depuis) |
| **Writable Stream** | Destination de donnees (on ecrit vers) |
| **Transform Stream** | Modifie les donnees en transit (Readable + Writable) |
| **Duplex Stream** | Readable et Writable independants |
| **pipe()** | Connecte un Readable a un Writable |
| **pipeline()** | Version moderne de pipe() avec gestion des erreurs |
| **Backpressure** | Mecanisme de regulation quand le consommateur est plus lent |
| **highWaterMark** | Seuil du buffer interne avant activation de la backpressure |
| **drain** | Evenement emis quand le buffer d'un Writable se vide |

> **A retenir** : Les Streams sont le mecanisme de traitement de donnees le plus puissant de Node.js. Ils permettent de traiter des fichiers de n'importe quelle taille avec une memoire constante, de commencer a envoyer des donnees avant d'avoir tout recu, et de chainer des transformations elegamment. Utilise `pipeline()` de `stream/promises` pour chainer les streams de maniere sure et moderne.

---

## Navigation

| | Lien |
|---|---|
| Module precedent | [Module 02 — Node.js — Modules, FS & Process](./02-nodejs-modules-et-fs.md) |
| Module suivant | [Module 04 — Node.js — Serveur HTTP natif](./04-nodejs-serveur-http.md) |
| Quiz | [Quiz Module 03](../quizzes/03-nodejs-streams-et-buffers.quiz.md) |
| Lab | [Lab 03 — Streams en pratique](../labs/03-nodejs-streams-et-buffers.lab.md) |

---

> **A retenir** : Les Buffers sont la porte d'entree vers le monde binaire en Node.js, et les Streams sont la facon idiomatique de traiter de gros volumes de donnees. Meme si tu n'ecris pas de Streams tous les jours, tu en utilises a chaque requete HTTP, chaque lecture de fichier et chaque connexion base de donnees. Comprendre leur fonctionnement te rendra meilleur pour debugger et optimiser tes applications.
