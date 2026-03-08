// =============================================================================
// Lab 01 — Event Loop et Programmation Asynchrone (Solution)
// =============================================================================
// Objectifs :
//   - Comprendre l'ordre d'execution dans l'event loop
//   - Maitriser Promise.all, Promise.race, Promise.allSettled
//   - Utiliser EventEmitter pour creer un systeme d'evenements
// =============================================================================

import { EventEmitter } from 'node:events';
import { createTestRunner, sleep } from '../test-utils.js';

const { test, assert, assertEqual, assertGreaterThan, summary } = createTestRunner('Lab 01 — Event Loop');

// =============================================================================
// SOLUTION 1 : predictOrder()
// =============================================================================
// Ordre d'execution :
//   1. 'A' — synchrone
//   2. 'F' — synchrone
//   3. 'D' — process.nextTick (microtask prioritaire)
//   4. 'C' — Promise.then (microtask)
//   5. 'B' — setTimeout(0) (macrotask timer)
//   6. 'E' — setImmediate (macrotask check)

function predictOrder() {
  return ['A', 'F', 'D', 'C', 'B', 'E'];
}

// =============================================================================
// SOLUTION 2 : fetchAllParallel(tasks)
// =============================================================================

async function fetchAllParallel(tasks) {
  return Promise.all(tasks.map(task => task()));
}

// =============================================================================
// SOLUTION 3 : fetchFirstResolved(tasks)
// =============================================================================

async function fetchFirstResolved(tasks) {
  return Promise.race(tasks.map(task => task()));
}

// =============================================================================
// SOLUTION 4 : allSettledManual(promises)
// =============================================================================

async function allSettledManual(promises) {
  return Promise.all(
    promises.map(promise =>
      Promise.resolve(promise)
        .then(value => ({ status: 'fulfilled', value }))
        .catch(reason => ({ status: 'rejected', reason }))
    )
  );
}

// =============================================================================
// SOLUTION 5 : TaskRunner
// =============================================================================

class TaskRunner extends EventEmitter {
  async run(taskName, taskFn) {
    this.emit('start', { taskName });
    try {
      const result = await taskFn();
      this.emit('complete', { taskName, result });
      return result;
    } catch (error) {
      this.emit('error', { taskName, error });
      throw error;
    }
  }

  async runAll(tasks) {
    const results = [];
    for (let i = 0; i < tasks.length; i++) {
      const { name, fn } = tasks[i];
      this.emit('progress', { taskName: name, index: i, total: tasks.length });
      try {
        const result = await this.run(name, fn);
        results.push(result);
      } catch {
        results.push(null);
      }
    }
    return results;
  }
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 01 — Event Loop et Programmation Asynchrone\n');

// ── Test 1 : Ordre d'execution dans l'event loop ──────────────────────────
await test('predictOrder retourne le bon ordre', async () => {
  const order = predictOrder();
  assert(Array.isArray(order), 'predictOrder doit retourner un tableau');
  assertEqual(order.length, 6, 'Le tableau doit avoir 6 elements');
  assertEqual(order[0], 'A', 'A est synchrone, execute en premier');
  assertEqual(order[1], 'F', 'F est synchrone, execute en deuxieme');
  assertEqual(order[2], 'D', 'D (process.nextTick) est la microtask prioritaire');
  assertEqual(order[3], 'C', 'C (Promise.then) est une microtask');
  assertEqual(order[4], 'B', 'B (setTimeout) est une macrotask timer');
  assertEqual(order[5], 'E', 'E (setImmediate) est une macrotask check');
});

// ── Test 2 : Verification de l'ordre reel ─────────────────────────────────
await test('Verification de l\'ordre reel d\'execution', async () => {
  const executionOrder = [];

  await new Promise((resolve) => {
    executionOrder.push('A');
    setTimeout(() => executionOrder.push('B'), 0);
    Promise.resolve().then(() => executionOrder.push('C'));
    process.nextTick(() => executionOrder.push('D'));
    setImmediate(() => {
      executionOrder.push('E');
      resolve();
    });
    executionOrder.push('F');
  });

  // Petit delai pour s'assurer que setTimeout est execute
  await sleep(50);

  const predicted = predictOrder();
  assertEqual(executionOrder[0], predicted[0], 'Position 1 correcte');
  assertEqual(executionOrder[1], predicted[1], 'Position 2 correcte');
  assertEqual(executionOrder[2], predicted[2], 'Position 3 correcte');
  assertEqual(executionOrder[3], predicted[3], 'Position 4 correcte');
});

// ── Test 3 : fetchAllParallel ─────────────────────────────────────────────
await test('fetchAllParallel execute toutes les taches en parallele', async () => {
  const tasks = [
    async () => { await sleep(80); return 'result-1'; },
    async () => { await sleep(50); return 'result-2'; },
    async () => { await sleep(30); return 'result-3'; },
  ];

  const start = performance.now();
  const results = await fetchAllParallel(tasks);
  const duration = performance.now() - start;

  assertEqual(results.length, 3, 'Doit retourner 3 resultats');
  assertEqual(results[0], 'result-1', 'Premier resultat correct');
  assertEqual(results[1], 'result-2', 'Deuxieme resultat correct');
  assertEqual(results[2], 'result-3', 'Troisieme resultat correct');
  assert(duration < 150, `Doit s'executer en parallele (${Math.round(duration)}ms < 150ms)`);
});

// ── Test 4 : fetchAllParallel echoue si une tache echoue ──────────────────
await test('fetchAllParallel propage les erreurs', async () => {
  const tasks = [
    async () => 'ok',
    async () => { throw new Error('task failed'); },
  ];

  let caught = false;
  try {
    await fetchAllParallel(tasks);
  } catch (err) {
    caught = true;
    assertEqual(err.message, 'task failed', 'L\'erreur doit etre propagee');
  }
  assert(caught, 'fetchAllParallel doit rejeter si une tache echoue');
});

// ── Test 5 : fetchFirstResolved ───────────────────────────────────────────
await test('fetchFirstResolved retourne le premier resultat', async () => {
  const tasks = [
    async () => { await sleep(200); return 'slow'; },
    async () => { await sleep(30);  return 'fast'; },
    async () => { await sleep(100); return 'medium'; },
  ];

  const result = await fetchFirstResolved(tasks);
  assertEqual(result, 'fast', 'Doit retourner le resultat le plus rapide');
});

// ── Test 6 : allSettledManual ─────────────────────────────────────────────
await test('allSettledManual reproduit Promise.allSettled', async () => {
  const promises = [
    Promise.resolve('success-1'),
    Promise.reject(new Error('fail-1')),
    Promise.resolve('success-2'),
    Promise.reject(new Error('fail-2')),
  ];

  const results = await allSettledManual(promises);

  assertEqual(results.length, 4, 'Doit retourner 4 resultats');

  assertEqual(results[0].status, 'fulfilled', 'Premier: fulfilled');
  assertEqual(results[0].value, 'success-1', 'Premier: valeur correcte');

  assertEqual(results[1].status, 'rejected', 'Deuxieme: rejected');
  assertEqual(results[1].reason.message, 'fail-1', 'Deuxieme: raison correcte');

  assertEqual(results[2].status, 'fulfilled', 'Troisieme: fulfilled');
  assertEqual(results[2].value, 'success-2', 'Troisieme: valeur correcte');

  assertEqual(results[3].status, 'rejected', 'Quatrieme: rejected');
  assertEqual(results[3].reason.message, 'fail-2', 'Quatrieme: raison correcte');
});

// ── Test 7 : TaskRunner emet les bons evenements ──────────────────────────
await test('TaskRunner emet start et complete', async () => {
  const runner = new TaskRunner();
  const events = [];

  runner.on('start', (data) => events.push({ type: 'start', ...data }));
  runner.on('complete', (data) => events.push({ type: 'complete', ...data }));

  const result = await runner.run('my-task', async () => {
    await sleep(10);
    return 42;
  });

  assertEqual(result, 42, 'run() doit retourner le resultat');
  assertEqual(events.length, 2, 'Doit emettre 2 evenements');
  assertEqual(events[0].type, 'start', 'Premier evenement: start');
  assertEqual(events[0].taskName, 'my-task', 'Start avec le bon taskName');
  assertEqual(events[1].type, 'complete', 'Deuxieme evenement: complete');
  assertEqual(events[1].result, 42, 'Complete avec le bon resultat');
});

// ── Test 8 : TaskRunner runAll avec progress ──────────────────────────────
await test('TaskRunner runAll execute les taches sequentiellement', async () => {
  const runner = new TaskRunner();
  const events = [];

  runner.on('start', (data) => events.push({ type: 'start', ...data }));
  runner.on('progress', (data) => events.push({ type: 'progress', ...data }));
  runner.on('complete', (data) => events.push({ type: 'complete', ...data }));
  runner.on('error', (data) => events.push({ type: 'error', ...data }));

  const tasks = [
    { name: 'task-1', fn: async () => 'r1' },
    { name: 'task-2', fn: async () => { throw new Error('oops'); } },
    { name: 'task-3', fn: async () => 'r3' },
  ];

  const results = await runner.runAll(tasks);

  assertEqual(results.length, 3, 'Doit retourner 3 resultats');
  assertEqual(results[0], 'r1', 'Premier resultat correct');
  assertEqual(results[1], null, 'Deuxieme resultat est null (erreur)');
  assertEqual(results[2], 'r3', 'Troisieme resultat correct');

  const progressEvents = events.filter(e => e.type === 'progress');
  assertEqual(progressEvents.length, 3, 'Doit emettre 3 evenements progress');
  assertEqual(progressEvents[0].index, 0, 'Premier progress: index 0');
  assertEqual(progressEvents[0].total, 3, 'Premier progress: total 3');
});

summary();
