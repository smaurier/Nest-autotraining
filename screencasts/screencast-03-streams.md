# Screencast 03 — Streams & Buffers

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/03-nodejs-streams-et-buffers.md`
- **Lab associe** : `labs/lab-03-streams/`
- **Prerequis** : Screencast 02 (Modules, FS & Process)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Un fichier volumineux pour les demos (generer avec `dd` ou un script)

## Script

### [00:00-03:00] Introduction — Pourquoi les streams ?

> Salut ! Imaginez que vous devez copier un fichier de 2 Go. Si vous utilisez `fs.readFile`, Node.js va charger les 2 Go en memoire d'un coup. Votre serveur va exploser. Les streams resolvent ce probleme en traitant les donnees morceau par morceau.

**Action** : Afficher le slide de titre "Module 03 — Streams & Buffers".

> Un stream, c'est un flux de donnees. Au lieu de tout charger en memoire, on lit un petit bout, on le traite, on passe au suivant. C'est comme boire de l'eau au robinet plutot que de vider le barrage dans un verre.

**Action** : Generer un fichier de test volumineux.

```bash
node -e "
const fs = require('fs');
const ws = fs.createWriteStream('big-file.txt');
for (let i = 0; i < 1000000; i++) {
  ws.write('Ligne numero ' + i + ' avec du contenu supplementaire pour la taille.\n');
}
ws.end();
console.log('Fichier genere !');
"
```

### [03:00-06:00] Buffers — Les conteneurs de donnees brutes

> Avant de parler de streams, il faut comprendre les Buffers. Un Buffer, c'est un espace de memoire brut qui contient des octets. C'est comme ca que Node.js represente les donnees binaires.

**Action** : Demontrer les Buffers dans le terminal.

```javascript
// buffer-demo.js
// Creer un Buffer a partir d'une chaine
const buf1 = Buffer.from('Bonjour Node.js');
console.log(buf1);           // <Buffer 42 6f 6e 6a 6f 75 72 ...>
console.log(buf1.toString()); // Bonjour Node.js
console.log(buf1.length);    // 15 octets

// Buffer vide de taille fixe
const buf2 = Buffer.alloc(10);
console.log(buf2); // <Buffer 00 00 00 00 00 00 00 00 00 00>

// Concatener des Buffers
const buf3 = Buffer.concat([buf1, Buffer.from(' !!')]);
console.log(buf3.toString()); // Bonjour Node.js !!

// Encoder en base64
console.log(buf1.toString('base64')); // Qm9uam91ciBOb2RlLmpz
```

**Action** : Executer le script.

```bash
node buffer-demo.js
```

> Les Buffers sont la base des streams. Quand un stream lit un fichier, il produit des Buffers. Quand il ecrit, il consomme des Buffers.

### [06:00-10:00] Les quatre types de streams

> Il existe quatre types de streams dans Node.js : Readable, Writable, Transform et Duplex. On va voir les trois premiers.

**Action** : Creer un script de copie de fichier avec streams.

```javascript
// stream-copy.js
const fs = require('fs');

const readable = fs.createReadStream('big-file.txt');
const writable = fs.createWriteStream('big-file-copy.txt');

let chunks = 0;

readable.on('data', (chunk) => {
  chunks++;
  writable.write(chunk);
});

readable.on('end', () => {
  writable.end();
  console.log(`Copie terminee en ${chunks} morceaux`);
});

readable.on('error', (err) => console.error('Erreur lecture :', err));
writable.on('error', (err) => console.error('Erreur ecriture :', err));
```

**Action** : Executer et comparer avec la methode classique.

```bash
node stream-copy.js
```

> La copie s'est faite morceau par morceau, sans jamais charger tout le fichier en memoire. C'est beaucoup plus efficace. Mais ce code est un peu verbeux. Node.js fournit une methode plus simple : `pipe`.

**Action** : Montrer la version avec pipe.

```javascript
// stream-pipe.js
const fs = require('fs');

fs.createReadStream('big-file.txt')
  .pipe(fs.createWriteStream('big-file-pipe.txt'))
  .on('finish', () => console.log('Copie terminee avec pipe !'));
```

> Une seule ligne pour la copie. `pipe` connecte un Readable a un Writable et gere automatiquement le flux.

### [10:00-14:00] Transform streams et pipeline

> Les Transform streams sont particulierement puissants. Ils lisent des donnees, les transforment, et les renvoient. C'est un Readable et un Writable en un.

**Action** : Creer un Transform stream qui met le texte en majuscules.

```javascript
// transform-demo.js
const { Transform, pipeline } = require('stream');
const fs = require('fs');

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
});

pipeline(
  fs.createReadStream('big-file.txt'),
  upperCase,
  fs.createWriteStream('big-file-upper.txt'),
  (err) => {
    if (err) {
      console.error('Erreur pipeline :', err);
    } else {
      console.log('Transformation terminee !');
    }
  }
);
```

**Action** : Executer et verifier le resultat.

```bash
node transform-demo.js
head -5 big-file-upper.txt
```

> `pipeline` est la version moderne de pipe. Elle gere les erreurs correctement et nettoie les streams en cas de probleme. Utilisez toujours `pipeline` plutot que `.pipe()` en production.

> On peut chainer plusieurs Transform streams. Par exemple : lire un fichier, filtrer certaines lignes, les transformer, les ecrire.

**Action** : Montrer un pipeline avec compression.

```javascript
// compress-demo.js
const { pipeline } = require('stream');
const fs = require('fs');
const zlib = require('zlib');

pipeline(
  fs.createReadStream('big-file.txt'),
  zlib.createGzip(),
  fs.createWriteStream('big-file.txt.gz'),
  (err) => {
    if (err) console.error('Erreur :', err);
    else console.log('Compression terminee !');
  }
);
```

```bash
node compress-demo.js
ls -lh big-file.txt big-file.txt.gz
```

> Regardez la difference de taille ! La compression gzip via un stream, c'est exactement ce que font les serveurs web quand ils envoient des reponses compressees.

### [14:00-16:30] Recap — Streams au quotidien

> Les streams sont partout dans Node.js. Les requetes HTTP sont des streams. Les reponses aussi. Quand on fera notre serveur HTTP, on utilisera des streams. Express, NestJS, tout repose la-dessus.

**Action** : Afficher le slide recap.

> Retenez ceci : Readable pour lire, Writable pour ecrire, Transform pour transformer, pipeline pour les connecter proprement. Et les Buffers, c'est la representation bas-niveau des donnees binaires.

> Le lab est dans `labs/lab-03-streams/`. Vous allez copier des fichiers, creer des Transform streams, et utiliser pipeline. A tout a l'heure pour construire notre premier serveur HTTP !

## Points d'attention pour l'enregistrement
- Generer le fichier de test avant l'enregistrement et verifier sa taille
- Montrer la consommation memoire avec process.memoryUsage() pour illustrer l'avantage des streams
- La compression gzip doit montrer une difference de taille significative
- Ne pas aller trop vite sur le concept de Transform, c'est souvent nouveau pour le public
