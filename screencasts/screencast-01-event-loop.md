# Screencast 01 — Event Loop & Asynchrone

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/01-nodejs-event-loop.md`
- **Lab associe** : `labs/lab-01-event-loop/`
- **Prerequis** : Screencast 00 (Prerequis & Le monde du backend)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Fichier `labs/lab-01-event-loop/exercise.js` pret

## Script

### [00:00-03:00] Introduction — Pourquoi l'event loop ?

> Salut ! Aujourd'hui on va s'attaquer a l'un des concepts les plus importants de Node.js : l'event loop. C'est ce qui fait de Node.js un environnement si performant pour gerer des milliers de connexions simultanees.

**Action** : Afficher le slide de titre "Module 01 — Event Loop & Asynchrone".

> Dans un langage comme Java ou PHP, chaque requete est traitee par un thread dedie. Si vous avez 1000 requetes simultanees, vous avez 1000 threads. Ca consomme beaucoup de memoire. Node.js fait autrement : il n'a qu'un seul thread principal, et il utilise l'event loop pour gerer la concurrence.

**Action** : Afficher un schema comparant le modele multi-thread vs l'event loop.

> L'event loop, c'est une boucle infinie qui verifie en permanence : "Est-ce qu'il y a des callbacks a executer ? Est-ce qu'une operation I/O est terminee ? Est-ce qu'un timer a expire ?" Et elle execute les taches dans un ordre bien precis.

### [03:00-07:00] Demo — Predire l'ordre d'execution

> On va faire un exercice concret. Je vais ecrire du code et vous devez deviner l'ordre d'affichage des console.log. C'est le meilleur moyen de comprendre l'event loop.

**Action** : Creer un fichier `event-loop-demo.js` dans l'editeur.

```javascript
// event-loop-demo.js
console.log('1 - Debut');

setTimeout(() => {
  console.log('2 - setTimeout 0ms');
}, 0);

Promise.resolve().then(() => {
  console.log('3 - Promise');
});

process.nextTick(() => {
  console.log('4 - nextTick');
});

setImmediate(() => {
  console.log('5 - setImmediate');
});

console.log('6 - Fin');
```

> Avant d'executer, reflechissons. Les console.log synchrones s'executent d'abord. Ensuite, process.nextTick a la priorite la plus haute parmi les callbacks. Puis les microtasks (Promises). Puis les timers (setTimeout). Et enfin setImmediate.

**Action** : Executer le script.

```bash
node event-loop-demo.js
```

> L'ordre est : 1, 6, 4, 3, 2, 5. Le synchrone d'abord, puis nextTick, puis la Promise, puis setTimeout, puis setImmediate. C'est exactement ce que l'event loop dicte.

### [07:00-11:00] Callbacks, Promises et async/await

> Historiquement, Node.js utilisait des callbacks pour gerer l'asynchrone. Ca marchait, mais ca devenait vite illisible. On appelait ca le "callback hell".

**Action** : Montrer un exemple de callback hell.

```javascript
// Le callback hell - a eviter !
const fs = require('fs');

fs.readFile('fichier1.txt', 'utf8', (err, data1) => {
  if (err) throw err;
  fs.readFile('fichier2.txt', 'utf8', (err, data2) => {
    if (err) throw err;
    fs.writeFile('resultat.txt', data1 + data2, (err) => {
      if (err) throw err;
      console.log('Termine !');
    });
  });
});
```

> C'est une pyramide de l'enfer. Heureusement, les Promises sont arrivees, puis async/await. Regardez la difference.

**Action** : Reecrire le meme code avec async/await.

```javascript
// La version moderne avec async/await
const fs = require('fs').promises;

async function combinerFichiers() {
  const data1 = await fs.readFile('fichier1.txt', 'utf8');
  const data2 = await fs.readFile('fichier2.txt', 'utf8');
  await fs.writeFile('resultat.txt', data1 + data2);
  console.log('Termine !');
}

combinerFichiers().catch(console.error);
```

> C'est le meme comportement, mais le code est plat, lisible, maintenable. async/await c'est du sucre syntaxique au-dessus des Promises. Et les Promises, c'est juste un pattern au-dessus des callbacks.

### [11:00-15:00] Gestion des erreurs asynchrones

> Un point crucial : la gestion des erreurs en asynchrone. Avec les callbacks, on verifie `err` a chaque etape. Avec async/await, on utilise try/catch.

**Action** : Ecrire un exemple avec try/catch.

```javascript
async function lireFichier() {
  try {
    const data = await fs.readFile('inexistant.txt', 'utf8');
    console.log(data);
  } catch (error) {
    console.error('Erreur :', error.message);
  }
}

lireFichier();
```

> Attention : si vous oubliez le try/catch ou le .catch() sur une Promise, l'erreur sera une "unhandled promise rejection". Node.js terminera le processus. C'est une source de bugs tres courante.

**Action** : Montrer ce qui se passe sans catch.

```javascript
// Danger : pas de catch !
async function danger() {
  const data = await fs.readFile('inexistant.txt', 'utf8');
  console.log(data);
}

danger(); // UnhandledPromiseRejection -> crash
```

```bash
node danger.js
```

> Vous voyez le message d'erreur ? "UnhandledPromiseRejectionWarning". En production, ca tue votre serveur. Toujours catcher vos erreurs.

### [15:00-18:00] Parallelisme avec Promise.all

> Dernier point : quand vous avez plusieurs operations asynchrones independantes, ne les attendez pas une par une. Utilisez Promise.all pour les lancer en parallele.

**Action** : Comparer les deux approches.

```javascript
// Sequentiel - lent
async function sequentiel() {
  const start = Date.now();
  await sleep(1000);
  await sleep(1000);
  await sleep(1000);
  console.log(`Sequentiel : ${Date.now() - start}ms`); // ~3000ms
}

// Parallele - rapide
async function parallele() {
  const start = Date.now();
  await Promise.all([sleep(1000), sleep(1000), sleep(1000)]);
  console.log(`Parallele : ${Date.now() - start}ms`); // ~1000ms
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Action** : Executer les deux fonctions et comparer les temps.

```bash
node promise-all-demo.js
```

> 3 secondes en sequentiel, 1 seconde en parallele. Trois fois plus rapide. Promise.all attend que toutes les Promises soient resolues. Si une seule echoue, tout echoue. Pour gerer ca, il y a aussi Promise.allSettled qui ne rejette jamais.

### [18:00-19:30] Recap — L'event loop demystifiee

> Resumons. L'event loop est le coeur de Node.js. Elle gere l'asynchrone avec un seul thread grace a des callbacks, des Promises et async/await. L'ordre d'execution suit des priorites : synchrone, nextTick, microtasks, timers, I/O, setImmediate.

**Action** : Afficher le slide recap avec le schema de l'event loop.

> Dans le lab associe, vous allez experimenter avec ces concepts. Predire des ordres d'execution, gerer des erreurs, utiliser Promise.all. C'est dans `labs/lab-01-event-loop/`. Allez-y, c'est en pratiquant qu'on comprend. A la prochaine !

## Points d'attention pour l'enregistrement
- Prendre le temps de laisser le public reflechir avant de reveler l'ordre d'execution
- Bien montrer les resultats dans le terminal a chaque execution
- Insister sur le piege de l'erreur non catchee — c'est un probleme reel en production
- La demo Promise.all doit montrer une difference de temps clairement visible
