# Lab 01 — Event Loop et Programmation Asynchrone

## Objectifs

- Comprendre l'ordre d'execution dans l'event loop de Node.js
- Maitriser les APIs de concurrence : `Promise.all`, `Promise.race`, `Promise.allSettled`
- Implementer un pattern allSettled manuellement
- Utiliser la classe `EventEmitter` pour creer un systeme d'evenements personnalise

## Pre-requis

- Node.js >= 18 installe
- Aucune dependance externe (pure Node.js)

## Instructions

1. Ouvrez le fichier `exercise.ts`
2. Completez chaque section marquee `TODO`
3. Lancez le fichier avec `npx tsx exercise.ts`
4. Verifiez que tous les tests passent (8/8)

## TODOs

| # | Description |
|---|-------------|
| 1 | Implementer `predictOrder()` — predire l'ordre d'execution dans l'event loop |
| 2 | Implementer `fetchAllParallel(tasks)` — executer des taches en parallele avec `Promise.all` |
| 3 | Implementer `fetchFirstResolved(tasks)` — obtenir le premier resultat avec `Promise.race` |
| 4 | Implementer `allSettledManual(promises)` — reproduire `Promise.allSettled` sans l'utiliser |
| 5 | Creer la classe `TaskRunner` basee sur `EventEmitter` avec les evenements `start`, `progress`, `complete`, `error` |

## Rappels

### Ordre de priorite dans l'event loop

1. `process.nextTick()` — microtask (priorite la plus haute)
2. `Promise.resolve().then()` — microtask
3. `setTimeout(fn, 0)` — macrotask (timer)
4. `setImmediate(fn)` — macrotask (check phase)

### APIs de concurrence

- `Promise.all(promises)` — attend que toutes les promesses soient resolues (echoue si une echoue)
- `Promise.race(promises)` — retourne la premiere promesse resolue ou rejetee
- `Promise.allSettled(promises)` — attend toutes les promesses et retourne leur statut

### EventEmitter

```typescript
import { EventEmitter } from 'node:events';

class MyEmitter extends EventEmitter {}
const emitter = new MyEmitter();
emitter.on('event', (data) => console.log(data));
emitter.emit('event', 'hello');
```
