# Module 01 — Node.js — Event Loop & Asynchrone

> **Objectif** : Comprendre en profondeur l'event loop de Node.js, maîtriser les mécanismes asynchrones (callbacks, Promises, async/await), et savoir predire l'ordre d'exécution du code asynchrone.
>
> **Difficulte** : ⭐⭐ (intermédiaire)

---

> **Si tu as fait le cours 02-JS Runtime** : ce module couvre l'event loop sous l'angle pratique (construire un serveur Node.js). Le cours 02 couvre la théorie en profondeur (V8, phases libuv, microtasks vs macrotasks). Les deux se completent — ici tu appliques, la-bas tu comprends les mécanismes internes.

## 1. Pourquoi Node.js est différent

### 1.1 Le modèle mono-thread

Node.js exécuté ton code JavaScript dans un **seul thread** (thread principal). C'est une différence fondamentale avec des langages comme Java ou C# qui creent un thread par requête.

> **Analogie** : Imagine un restaurant avec un seul serveur (thread principal). Au lieu d'attendre à chaque table que le plat soit pret, le serveur prend la commande, la transmet en cuisine (operation I/O), et passe immediatement à la table suivante. Quand un plat est pret, la cuisine le signale et le serveur le livre. Ce serveur unique peut gérer des dizaines de tables en parallele — tant qu'il ne reste pas plante devant le four.

```
  Modele multi-thread (Java, C#)          Modele mono-thread (Node.js)
  ┌──────────────────────┐                ┌──────────────────────┐
  │ Requete 1 → Thread 1 │                │ Requete 1 ─┐         │
  │ Requete 2 → Thread 2 │                │ Requete 2 ─┤ Thread  │
  │ Requete 3 → Thread 3 │                │ Requete 3 ─┤ unique  │
  │ Requete 4 → Thread 4 │                │ Requete 4 ─┘         │
  └──────────────────────┘                └──────────────────────┘
  Chaque requete a son thread             Toutes les requetes sur un thread
  (cout memoire eleve)                    (event loop gere la concurrence)
```

### 1.2 Non-blocking I/O

L'avantage du modèle mono-thread de Node.js est que les operations I/O (lecture fichier, requête base de donnees, appel réseau) sont **non-bloquantes** :

```typescript
// BLOQUANT (mauvais) — imagine ca dans un serveur qui recoit 1000 requetes
const data = fs.readFileSync('gros-fichier.txt'); // Le thread est bloque pendant la lecture
console.log(data); // On ne peut rien faire d'autre en attendant

// NON-BLOQUANT (bon) — le thread est libre pendant la lecture
fs.readFile('gros-fichier.txt', (err, data) => {
  console.log(data); // Appele quand la lecture est terminee
});
console.log('Je peux faire autre chose en attendant !');
```

> **Piege classique** : "Si Node.js est mono-thread, comment peut-il etre performant ?" — Parce que 90% du temps d'une application web est passe a attendre des I/O (base de donnees, fichiers, réseau). Node.js ne bloque pas pendant cette attente, il traite d'autres requêtes. C'est pour ça que Node.js excelle pour les API et les applications I/O-intensives.

---

## 2. L'Event Loop en detail

### 2.1 Les composants de l'architecture

```
  ┌──────────────────────────────────────────┐
  │              Code JavaScript              │
  │            (ton application)               │
  └────────────────┬─────────────────────────┘
                   │
  ┌────────────────▼─────────────────────────┐
  │              V8 Engine                    │
  │         (execution JS, call stack)        │
  └────────────────┬─────────────────────────┘
                   │
  ┌────────────────▼─────────────────────────┐
  │           Node.js Bindings               │
  │      (pont entre JS et C/C++)            │
  └────────────────┬─────────────────────────┘
                   │
  ┌────────────────▼─────────────────────────┐
  │              libuv                        │
  │    (event loop, thread pool, I/O async)  │
  └──────────────────────────────────────────┘
```

### 2.2 Le Call Stack (pile d'appels)

Le **call stack** est une pile LIFO (Last In, First Out) qui garde trace des fonctions en cours d'exécution :

```typescript
function multiplier(a, b) {
  return a * b;
}

function calculerSurface(largeur, hauteur) {
  return multiplier(largeur, hauteur);
}

function afficher() {
  const surface = calculerSurface(5, 3);
  console.log(`Surface : ${surface}`);
}

afficher();
```

```
  Etape 1         Etape 2            Etape 3            Etape 4
  ┌───────────┐   ┌───────────┐      ┌───────────┐      ┌───────────┐
  │           │   │           │      │multiplier │      │           │
  │           │   │calculer   │      │calculer   │      │calculer   │
  │ afficher  │   │ afficher  │      │ afficher  │      │ afficher  │
  └───────────┘   └───────────┘      └───────────┘      └───────────┘
  afficher()      calculerSurface()  multiplier()       multiplier retourne
  empile          empile             empile              depile
```

### 2.3 Les phases de l'Event Loop

L'event loop de Node.js (gérée par libuv) est composee de **6 phases** qui s'executent en boucle :

```
   ┌───────────────────────────┐
┌─▶│        Timers              │  setTimeout, setInterval
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │     Pending callbacks      │  Callbacks I/O differees (erreurs systeme)
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │       Idle, prepare        │  Usage interne Node.js
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │          Poll              │  I/O callbacks (fs, network, etc.)
│  └──────────┬────────────────┘   C'est ici que Node "attend" les evenements
│  ┌──────────▼────────────────┐
│  │         Check              │  setImmediate
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │      Close callbacks       │  socket.on('close'), server.close
│  └──────────┬────────────────┘
└─────────────┘
```

> **A retenir** : A chaque iteration de la boucle, Node.js parcourt ces phases dans l'ordre. Entre chaque phase, il traite les **microtasks** (Promises) et les callbacks de `process.nextTick`.

### 2.4 La Callback Queue et la Microtask Queue

Il y a en realite **deux files d'attente** importantes :

| File | Contenu | Priorite |
|---|---|---|
| **Microtask Queue** | Callbacks de `Promise.then/catch/finally`, `process.nextTick`, `queueMicrotask` | **Haute** — traitee entre chaque phase de l'event loop |
| **Macrotask Queue** (Callback Queue) | `setTimeout`, `setInterval`, `setImmediate`, I/O callbacks | **Normale** — traitee à la phase correspondante |

```typescript
// Demonstration de l'ordre de priorite
console.log('1. Synchrone');

setTimeout(() => console.log('2. setTimeout (macrotask)'), 0);

Promise.resolve().then(() => console.log('3. Promise (microtask)'));

process.nextTick(() => console.log('4. nextTick (microtask prioritaire)'));

console.log('5. Synchrone');

// Sortie :
// 1. Synchrone
// 5. Synchrone
// 4. nextTick (microtask prioritaire)
// 3. Promise (microtask)
// 2. setTimeout (macrotask)
```

> **Piege classique** : `setTimeout(fn, 0)` ne signifie PAS "exécuté immediatement". Ça signifie "exécuté au prochain passage dans la phase Timers de l'event loop, au plus tot dans 0ms". En pratique, il y a toujours un leger delai, et les microtasks passent avant.

---

## 3. libuv et le Thread Pool

### 3.1 Qu'est-ce que libuv

**libuv** est la bibliotheque C qui fournit a Node.js :

- L'event loop
- Un **thread pool** (par defaut 4 threads) pour les operations qui ne peuvent pas etre async au niveau OS
- Des abstractions cross-platform pour le réseau, les fichiers, les DNS, etc.

### 3.2 Ce qui utilise le thread pool

| Operation | Thread pool | Mécanisme OS natif |
|---|---|---|
| `fs.readFile` | Oui | |
| `dns.lookup` | Oui | |
| `crypto.pbkdf2` | Oui | |
| `zlib.deflate` | Oui | |
| Requête HTTP sortante | | Oui (epoll/kqueue/IOCP) |
| Serveur TCP/HTTP | | Oui (epoll/kqueue/IOCP) |
| `dns.resolve` | | Oui (c-ares) |

```typescript
// Le thread pool a 4 threads par defaut
// Tu peux l'augmenter via une variable d'environnement :
process.env.UV_THREADPOOL_SIZE = 8; // Doit etre defini AVANT tout require

// Demonstration : 4 operations crypto en parallele
const crypto = require('crypto');

const start = Date.now();

// Ces 4 operations tournent chacune sur un thread du pool
for (let i = 0; i < 4; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
    console.log(`Hash ${i + 1} termine en ${Date.now() - start}ms`);
  });
}

// Si le pool a 4 threads, les 4 finissent quasi en meme temps (~300ms)
// Si tu en lances 8, les 4 premiers finissent a ~300ms, les 4 suivants a ~600ms
```

> **Analogie** : Le thread pool c'est comme avoir 4 cuisiniers dans la cuisine du restaurant. Le serveur (event loop) donne les commandes, et les 4 cuisiniers travaillent en parallele. Si tu as plus de 4 commandes simultanees, certaines doivent attendre qu'un cuisinier se libere.

---

## 4. setTimeout vs setImmediate vs process.nextTick

### 4.1 Differences fondamentales

| Fonction | Quand ça s'exécuté | Phase de l'event loop |
|---|---|---|
| `process.nextTick(fn)` | Immediatement après l'operation en cours, AVANT la prochaine phase | Entre les phases (microtask) |
| `Promise.resolve().then(fn)` | Après tous les nextTick, AVANT la prochaine phase | Entre les phases (microtask) |
| `setTimeout(fn, 0)` | Au prochain passage dans la phase Timers | Phase Timers |
| `setImmediate(fn)` | Au prochain passage dans la phase Check | Phase Check |

### 4.2 Ordre d'exécution détaillé

```typescript
// Exercice d'ordre d'execution — essaie de predire AVANT d'executer
console.log('A: synchrone debut');

setTimeout(() => {
  console.log('B: setTimeout 0');
}, 0);

setImmediate(() => {
  console.log('C: setImmediate');
});

process.nextTick(() => {
  console.log('D: nextTick 1');
  process.nextTick(() => {
    console.log('E: nextTick imbrique');
  });
});

Promise.resolve().then(() => {
  console.log('F: Promise 1');
}).then(() => {
  console.log('G: Promise 2');
});

console.log('H: synchrone fin');

// Sortie garantie :
// A: synchrone debut
// H: synchrone fin
// D: nextTick 1
// E: nextTick imbrique
// F: Promise 1
// G: Promise 2
// B: setTimeout 0      (l'ordre B/C peut varier en dehors d'un contexte I/O)
// C: setImmediate
```

> **Piege classique** : L'ordre entre `setTimeout(fn, 0)` et `setImmediate(fn)` n'est PAS garanti quand ils sont appeles dans le scope global (en dehors d'un callback I/O). Par contre, a l'interieur d'un callback I/O (comme `fs.readFile`), `setImmediate` s'exécuté TOUJOURS avant `setTimeout`.

```typescript
const fs = require('fs');

// A l'interieur d'un callback I/O, l'ordre EST garanti
fs.readFile(__filename, () => {
  setTimeout(() => console.log('setTimeout'), 0);
  setImmediate(() => console.log('setImmediate'));
});

// Sortie TOUJOURS :
// setImmediate
// setTimeout
```

### 4.3 Quand utiliser quoi

| Cas d'usage | Utilise |
|---|---|
| Differ un callback après le return en cours | `process.nextTick` |
| Exécuter après la phase I/O courante | `setImmediate` |
| Delai temporel (même 0ms) | `setTimeout` |
| Gestion de Promises et async/await | Microtask automatique |

> **Bonne pratique** : Prefere `setImmediate` a `process.nextTick` dans la plupart des cas. Un usage excessif de `process.nextTick` peut "affamer" l'event loop car les nextTick sont traites de façon recursive avant de passer à la phase suivante.

---

## 5. De Callbacks a async/await — L'evolution historique

### 5.1 Les Callbacks (Node.js originel)

Le pattern original de Node.js est le **error-first callback** :

```typescript
const fs = require('fs');

// Convention : le premier argument du callback est TOUJOURS l'erreur
fs.readFile('fichier.txt', 'utf-8', (err, data) => {
  if (err) {
    console.error('Erreur :', err.message);
    return;
  }
  console.log('Contenu :', data);
});
```

Le problème : le **callback hell** (où pyramide of doom) :

```typescript
// Callback hell — code illisible et difficile a maintenir
fs.readFile('config.json', 'utf-8', (err, configStr) => {
  if (err) return handleError(err);
  const config = JSON.parse(configStr);

  db.connect(config.database, (err, connection) => {
    if (err) return handleError(err);

    connection.query('SELECT * FROM users', (err, users) => {
      if (err) return handleError(err);

      users.forEach((user) => {
        sendEmail(user.email, 'Bienvenue', (err, result) => {
          if (err) return handleError(err);
          console.log(`Email envoye a ${user.email}`);
        });
      });
    });
  });
});
```

### 5.2 Les Promises (ES2015 / ES6)

Les Promises permettent de chainer les operations et d'éviter le callback hell :

```typescript
// Une Promise represente une valeur future
const maPromise = new Promise((resolve, reject) => {
  // Operation asynchrone
  setTimeout(() => {
    const succes = true;
    if (succes) {
      resolve('Donnees recues !');  // Succes
    } else {
      reject(new Error('Echec'));   // Echec
    }
  }, 1000);
});

// Utilisation
maPromise
  .then(data => console.log(data))    // 'Donnees recues !'
  .catch(err => console.error(err))   // En cas d'erreur
  .finally(() => console.log('Fini'));  // Toujours execute
```

Les 3 états d'une Promise :

```
  ┌────────────┐
  │  PENDING   │  ← Etat initial, en cours d'execution
  └─────┬──────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
┌──────┐  ┌──────────┐
│FULFILLED│  │ REJECTED │  ← Etats finaux (settled)
│(resolve)│  │ (reject) │
└─────────┘  └──────────┘
```

Refactoring du callback hell en Promises :

```typescript
const fsPromises = require('fs/promises');

fsPromises.readFile('config.json', 'utf-8')
  .then(configStr => JSON.parse(configStr))
  .then(config => db.connect(config.database))
  .then(connection => connection.query('SELECT * FROM users'))
  .then(users => Promise.all(
    users.map(user => sendEmail(user.email, 'Bienvenue'))
  ))
  .then(results => console.log('Tous les emails envoyes'))
  .catch(err => console.error('Erreur :', err.message));
```

### 5.3 async/await (ES2017 / ES8)

`async/await` est du sucre syntaxique au-dessus des Promises. Le code ressemble a du code synchrone mais reste asynchrone :

```typescript
const fsPromises = require('fs/promises');

async function envoyerEmails() {
  try {
    const configStr = await fsPromises.readFile('config.json', 'utf-8');
    const config = JSON.parse(configStr);

    const connection = await db.connect(config.database);
    const users = await connection.query('SELECT * FROM users');

    for (const user of users) {
      await sendEmail(user.email, 'Bienvenue');
      console.log(`Email envoye a ${user.email}`);
    }

    console.log('Tous les emails envoyes');
  } catch (err) {
    console.error('Erreur :', err.message);
  }
}

envoyerEmails();
```

> **A retenir** : `async/await` est la façon moderne d'écrire du code asynchrone en Node.js. Utilise toujours `async/await` sauf si tu as une bonne raison de ne pas le faire. Le code est plus lisible, plus debuggable et les stack traces sont meilleures.

### 5.4 Comparaison cote a cote

```typescript
// === Callbacks ===
function getUser_callback(id, callback) {
  db.query(`SELECT * FROM users WHERE id = ${id}`, (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
}

// === Promises ===
function getUser_promise(id) {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}

// === async/await ===
async function getUser_async(id) {
  return await db.query(`SELECT * FROM users WHERE id = ${id}`);
}
```

---

## 6. Error Handling asynchrone

### 6.1 try/catch avec async/await

```typescript
async function risque() {
  try {
    const result = await operationDangereuse();
    return result;
  } catch (err) {
    console.error('Erreur attrapee :', err.message);
    throw err; // Re-throw si tu veux propager l'erreur
  } finally {
    // Toujours execute (nettoyage, fermeture de connexion, etc.)
    console.log('Nettoyage effectue');
  }
}
```

### 6.2 .catch() avec les Promises

```typescript
// Si tu n'utilises pas async/await :
fetchData()
  .then(data => processData(data))
  .then(result => saveResult(result))
  .catch(err => {
    // Attrape les erreurs de TOUTE la chaine
    console.error('Erreur dans la chaine :', err.message);
  });
```

### 6.3 Unhandled Rejections

```typescript
// DANGER : Promise sans catch ni await dans un try/catch
async function mauvais() {
  fetchData(); // Promise non attendue et non geree !
  // Si fetchData rejette, l'erreur sera PERDUE
}

// BON : toujours gerer les rejections
async function bon() {
  await fetchData(); // await dans un try/catch
}

// Filet de securite global (a mettre dans le fichier principal)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise non geree :', reason);
  // En production, log et arrete proprement le processus
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Exception non attrapee :', err);
  process.exit(1);
});
```

> **Piege classique** : Depuis Node.js 15, les `unhandledRejection` font planter le processus par defaut. Avant Node 15, elles etaient ignorees silencieusement — ce qui causait des bugs très difficiles a trouver. Gere TOUJOURS tes Promises.

---

## 7. Promise combinators

### 7.1 Promise.all — Tout ou rien

```typescript
// Execute toutes les Promises en parallele
// Rejette des que l'UNE d'entre elles rejette

const [users, posts, comments] = await Promise.all([
  fetch('/api/users').then(r => r.json()),
  fetch('/api/posts').then(r => r.json()),
  fetch('/api/comments').then(r => r.json()),
]);

// Les 3 requetes partent en meme temps
// Resultat disponible quand les 3 ont termine
// Si une echoue, TOUT echoue immediatement
```

### 7.2 Promise.allSettled — Tout le monde termine

```typescript
// Attend que TOUTES les Promises soient terminees (fulfilled ou rejected)
// Ne rejette JAMAIS

const results = await Promise.allSettled([
  fetch('/api/users'),
  fetch('/api/posts'),
  fetch('/api/failing-endpoint'),
]);

results.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    console.log(`Requete ${i} reussie :`, result.value);
  } else {
    console.log(`Requete ${i} echouee :`, result.reason);
  }
});

// Utile quand tu veux que toutes les operations se terminent
// meme si certaines echouent (ex: envoi d'emails en lot)
```

### 7.3 Promise.race — Le premier qui finit

```typescript
// Renvoie le resultat de la PREMIERE Promise qui se resout (ou rejette)

// Cas d'usage : timeout sur une requete
async function fetchWithTimeout(url, timeoutMs) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

try {
  const response = await fetchWithTimeout('/api/slow-endpoint', 5000);
  const data = await response.json();
} catch (err) {
  console.log(err.message); // 'Timeout' si la requete prend plus de 5s
}
```

### 7.4 Promise.any — Le premier qui reussit

```typescript
// Renvoie le resultat de la PREMIERE Promise qui se RESOUT (fulfilled)
// Ignore les rejections tant qu'au moins une reussit
// Rejette uniquement si TOUTES echouent (AggregateError)

// Cas d'usage : essayer plusieurs serveurs miroirs
const data = await Promise.any([
  fetch('https://mirror1.example.com/data'),
  fetch('https://mirror2.example.com/data'),
  fetch('https://mirror3.example.com/data'),
]);
// Renvoie la reponse du premier miroir qui repond avec succes
```

### 7.5 Tableau comparatif

| Combinator | Court-circuite sur | Echoue si | Cas d'usage |
|---|---|---|---|
| `Promise.all` | Premiere rejection | Au moins une rejette | Requetes paralleles, toutes obligatoires |
| `Promise.allSettled` | Jamais | Jamais (toujours fulfilled) | Operations en lot, tolerant aux echecs |
| `Promise.race` | Premiere settled (OK ou KO) | La première rejette | Timeout, premier arrive |
| `Promise.any` | Premiere fulfilled | Toutes rejettent | Serveurs miroirs, fallback |

---

## 8. Le pattern EventEmitter

### 8.1 Qu'est-ce qu'un EventEmitter

Node.js utilise massivement le pattern **Observer** via la classe `EventEmitter`. Beaucoup de modules natifs (streams, http, fs) heritent d'EventEmitter.

```typescript
const EventEmitter = require('events');

// Creer un emetteur d'evenements
const emitter = new EventEmitter();

// S'abonner a un evenement
emitter.on('message', (data) => {
  console.log('Message recu :', data);
});

// Emettre un evenement
emitter.emit('message', 'Bonjour !');
// Message recu : Bonjour !

emitter.emit('message', { type: 'info', text: 'Test' });
// Message recu : { type: 'info', text: 'Test' }
```

### 8.2 Les méthodes principales

| Méthode | Role |
|---|---|
| `on(event, fn)` | Abonner un listener (peut etre appele plusieurs fois) |
| `once(event, fn)` | Abonner un listener qui se desabonne après le premier appel |
| `emit(event, ...args)` | Emettre un événement avec des arguments |
| `removeListener(event, fn)` | Desabonner un listener spécifique |
| `removeAllListeners([event])` | Desabonner tous les listeners (d'un événement ou de tous) |
| `listenerCount(event)` | Nombre de listeners pour un événement |
| `eventNames()` | Liste des événements ayant des listeners |

### 8.3 Exemple pratique : Logger avec EventEmitter

```typescript
const EventEmitter = require('events');

class Logger extends EventEmitter {
  info(message) {
    const log = { level: 'INFO', message, timestamp: new Date().toISOString() };
    this.emit('log', log);
    this.emit('info', log);
  }

  warn(message) {
    const log = { level: 'WARN', message, timestamp: new Date().toISOString() };
    this.emit('log', log);
    this.emit('warn', log);
  }

  error(message) {
    const log = { level: 'ERROR', message, timestamp: new Date().toISOString() };
    this.emit('log', log);
    this.emit('error', log);
  }
}

const logger = new Logger();

// Ecouter tous les logs
logger.on('log', (log) => {
  console.log(`[${log.timestamp}] ${log.level}: ${log.message}`);
});

// Ecouter uniquement les erreurs (par exemple pour alerter)
logger.on('error', (log) => {
  // Envoyer une alerte Slack, un email, etc.
  console.log('ALERTE ! Erreur detectee :', log.message);
});

logger.info('Serveur demarre');
logger.warn('Espace disque faible');
logger.error('Connexion base de donnees perdue');
```

### 8.4 once — Ecouter une seule fois

```typescript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// Ce listener sera appele une seule fois
emitter.once('ready', () => {
  console.log('Systeme pret !');
});

emitter.emit('ready'); // Affiche : 'Systeme pret !'
emitter.emit('ready'); // Rien — le listener a ete supprime
```

### 8.5 Gestion des erreurs EventEmitter

```typescript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// IMPORTANT : si tu emets 'error' sans listener,
// Node.js lance une exception et plante !
emitter.emit('error', new Error('Boom'));
// Crash : Error: Boom

// Solution : TOUJOURS ecouter l'evenement 'error'
emitter.on('error', (err) => {
  console.error('Erreur geree :', err.message);
});
emitter.emit('error', new Error('Boom'));
// Affiche : 'Erreur geree : Boom'
```

> **Piege classique** : Ne pas ecouter l'événement `'error'` sur un EventEmitter est une source frequente de crashes en production. Ajoute TOUJOURS un listener `'error'` sur tes emitters, serveurs HTTP, connexions bases de donnees, etc.

---

## 9. Exercices d'ordre d'exécution

### Exercice 1 — Niveau facile

Predis la sortie AVANT d'exécuter :

```typescript
console.log('1');

setTimeout(() => {
  console.log('2');
}, 0);

Promise.resolve().then(() => {
  console.log('3');
});

console.log('4');
```

<details>
<summary>Reponse</summary>

```
1
4
3
2
```

**Explication** :
1. `console.log('1')` — synchrone, exécuté immediatement
2. `setTimeout` — schedule dans la macrotask queue (phase Timers)
3. `Promise.then` — schedule dans la microtask queue
4. `console.log('4')` — synchrone, exécuté immediatement
5. Le call stack est vide → les microtasks sont traitees → `3`
6. Puis la macrotask → `2`

</details>

### Exercice 2 — Niveau intermédiaire

```typescript
console.log('A');

setTimeout(() => console.log('B'), 0);
setTimeout(() => console.log('C'), 0);

Promise.resolve()
  .then(() => {
    console.log('D');
    return Promise.resolve();
  })
  .then(() => console.log('E'));

process.nextTick(() => {
  console.log('F');
  process.nextTick(() => console.log('G'));
});

Promise.resolve().then(() => console.log('H'));

console.log('I');
```

<details>
<summary>Reponse</summary>

```
A
I
F
G
D
H
E
B
C
```

**Explication** :
1. `A`, `I` — synchrones
2. `F` — nextTick (priorite maximale parmi les microtasks)
3. `G` — nextTick imbrique (traite avant de passer aux Promises)
4. `D`, `H` — microtasks Promise (même "tick")
5. `E` — microtask Promise du `.then` suivant
6. `B`, `C` — macrotasks setTimeout

</details>

### Exercice 3 — Niveau avance

```typescript
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}

async function async2() {
  console.log('async2');
}

console.log('script start');

setTimeout(() => console.log('setTimeout'), 0);

async1();

new Promise((resolve) => {
  console.log('promise1');
  resolve();
}).then(() => {
  console.log('promise2');
});

console.log('script end');
```

<details>
<summary>Reponse</summary>

```
script start
async1 start
async2
promise1
script end
async1 end
promise2
setTimeout
```

**Explication** :
1. `'script start'` — synchrone
2. `setTimeout` — schedule en macrotask
3. `async1()` demarre :
   - `'async1 start'` — synchrone dans async1
   - `await async2()` : `async2()` s'exécuté → `'async2'`
   - Le `await` met en pause async1 et ajoute la suite (`async1 end`) en microtask
4. `new Promise(executor)` : l'executor est synchrone → `'promise1'`
   - `resolve()` schedule le `.then` en microtask
5. `'script end'` — synchrone
6. Microtasks : `'async1 end'`, puis `'promise2'`
7. Macrotasks : `'setTimeout'`

</details>

### Exercice 4 — Niveau expert

```typescript
setTimeout(() => {
  console.log('timeout1');
  Promise.resolve().then(() => console.log('promise inside timeout'));
}, 0);

setTimeout(() => {
  console.log('timeout2');
}, 0);

Promise.resolve()
  .then(() => {
    console.log('promise1');
    setTimeout(() => console.log('timeout inside promise'), 0);
  })
  .then(() => console.log('promise2'));
```

<details>
<summary>Reponse</summary>

```
promise1
promise2
timeout1
promise inside timeout
timeout2
timeout inside promise
```

**Explication** :
1. Les deux `setTimeout` sont schedules en macrotask
2. La Promise se resout → `'promise1'` (qui schedule un nouveau setTimeout)
3. Puis `'promise2'` (microtask chainee)
4. Premier setTimeout → `'timeout1'`, puis sa Promise → `'promise inside timeout'` (microtask traitee avant le prochain timer)
5. Deuxieme setTimeout → `'timeout2'`
6. Le setTimeout créé dans la Promise → `'timeout inside promise'`

</details>

---

## 10. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **Event Loop** | Boucle qui orchestre l'exécution du code async en 6 phases |
| **Call Stack** | Pile LIFO qui trace les fonctions en cours d'exécution |
| **Microtask Queue** | File pour les Promises et nextTick (priorite haute) |
| **Macrotask Queue** | File pour les timers, I/O, setImmediate (priorite normale) |
| **libuv** | Bibliotheque C qui fournit l'event loop et le thread pool |
| **Thread Pool** | 4 threads (par defaut) pour les operations bloquantes |
| **Non-blocking I/O** | Les operations I/O ne bloquent pas le thread principal |
| **Callback** | Fonction passee en argument, appelee quand l'operation est terminee |
| **Promise** | Objet representant une valeur future (pending, fulfilled, rejected) |
| **async/await** | Sucre syntaxique pour écrire du code asynchrone lisiblement |
| **EventEmitter** | Pattern Observer pour emettre et ecouter des événements |

> **A retenir** : L'event loop est le coeur de Node.js. Comprendre son fonctionnement te permet de predire l'ordre d'exécution du code, d'éviter les bugs asynchrones et d'écrire des applications performantes. Les microtasks (Promises, nextTick) passent toujours avant les macrotasks (timers, I/O).

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 00 — Prérequis & Le monde du backend](./00-prerequis-et-monde-backend.md) |
| Module suivant | [Module 02 — Node.js — Modules, FS & Process](./02-nodejs-modules-et-fs.md) |
| Quiz | [Quiz Module 01](../quizzes/01-nodejs-event-loop.quiz.md) |
| Lab | [Lab 01 — Event Loop en pratique](../labs/01-nodejs-event-loop.lab.md) |

---

> **A retenir** : Node.js est mono-thread mais pas mono-tache. L'event loop, libuv et le thread pool travaillent ensemble pour gérer la concurrence sans bloquer. Maîtriser l'ordre d'exécution (synchrone → nextTick → Promise → timer → I/O) est une compétence fondamentale pour tout développeur Node.js.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 01 event loop](../screencasts/screencast-01-event-loop.md)
2. **Lab** : [lab-01-event-loop](../labs/lab-01-event-loop/README)
3. **Visualisation** : [Event Loop](../visualizations/event-loop.html)
4. **Quiz** : [quiz 01 event loop](../quizzes/quiz-01-event-loop.html)
:::
