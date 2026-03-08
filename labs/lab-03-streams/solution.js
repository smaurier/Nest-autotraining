// =============================================================================
// Lab 03 — Streams (Solution)
// =============================================================================
// Objectifs :
//   - Copier un fichier avec des streams
//   - Creer des Transform streams personnalises
//   - Utiliser pipeline() pour chainer des streams
// =============================================================================

import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createTestRunner } from '../test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { test, assert, assertEqual, assertIncludes, summary } = createTestRunner('Lab 03 — Streams');

// =============================================================================
// SOLUTION 1 : copyFile(src, dest)
// =============================================================================

async function copyFile(src, dest) {
  await pipeline(
    createReadStream(src),
    createWriteStream(dest)
  );
}

// =============================================================================
// SOLUTION 2 : UppercaseTransform
// =============================================================================

class UppercaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// =============================================================================
// SOLUTION 3 : LineCounterTransform
// =============================================================================

class LineCounterTransform extends Transform {
  constructor(options) {
    super(options);
    this.lineNumber = 0;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');

    // Garder la derniere ligne (potentiellement incomplete) dans le buffer
    this.buffer = lines.pop();

    const numbered = lines.map(line => {
      if (line.length > 0) {
        this.lineNumber++;
        return `${this.lineNumber}: ${line}`;
      }
      return line;
    });

    if (numbered.length > 0) {
      this.push(numbered.join('\n') + '\n');
    }

    callback();
  }

  _flush(callback) {
    if (this.buffer.length > 0) {
      this.lineNumber++;
      this.push(`${this.lineNumber}: ${this.buffer}\n`);
    }
    callback();
  }
}

// =============================================================================
// SOLUTION 4 : CsvToJsonTransform
// =============================================================================

class CsvToJsonTransform extends Transform {
  constructor(options) {
    super(options);
    this.headers = null;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');

    // Garder la derniere ligne (potentiellement incomplete) dans le buffer
    this.buffer = lines.pop();

    for (const line of lines) {
      if (line.trim() === '') continue;

      if (!this.headers) {
        this.headers = line.split(',').map(h => h.trim());
        continue;
      }

      const values = line.split(',').map(v => v.trim());
      const obj = {};
      this.headers.forEach((header, i) => {
        obj[header] = values[i];
      });
      this.push(JSON.stringify(obj) + '\n');
    }

    callback();
  }

  _flush(callback) {
    // Traiter la derniere ligne si elle n'est pas vide
    if (this.buffer.trim() !== '' && this.headers) {
      const values = this.buffer.split(',').map(v => v.trim());
      const obj = {};
      this.headers.forEach((header, i) => {
        obj[header] = values[i];
      });
      this.push(JSON.stringify(obj) + '\n');
    }
    callback();
  }
}

// =============================================================================
// SOLUTION 5 : processFile(src, dest)
// =============================================================================

async function processFile(src, dest) {
  await pipeline(
    createReadStream(src),
    new UppercaseTransform(),
    new LineCounterTransform(),
    createWriteStream(dest)
  );
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 03 — Streams\n');

const tmpDir = join(__dirname, 'tmp');

// Setup : creer les fichiers de test
await mkdir(tmpDir, { recursive: true });

const inputTxt = join(tmpDir, 'input.txt');
const dataCsv = join(tmpDir, 'data.csv');

await writeFile(inputTxt, 'Hello World\nThis is a test\nStreams are powerful\n', 'utf-8');
await writeFile(dataCsv, 'name,price,category\nLaptop,999,electronics\nMouse,29,peripherals\nDesk,249,furniture\n', 'utf-8');

try {
  // ── Test 1 : copyFile ────────────────────────────────────────────────────
  await test('copyFile copie un fichier avec des streams', async () => {
    const dest = join(tmpDir, 'copy.txt');
    await copyFile(inputTxt, dest);

    const original = await readFile(inputTxt, 'utf-8');
    const copied = await readFile(dest, 'utf-8');
    assertEqual(copied, original, 'Le contenu copie doit etre identique');
  });

  // ── Test 2 : UppercaseTransform ──────────────────────────────────────────
  await test('UppercaseTransform convertit en majuscules', async () => {
    const dest = join(tmpDir, 'upper.txt');
    await pipeline(
      createReadStream(inputTxt),
      new UppercaseTransform(),
      createWriteStream(dest)
    );

    const content = await readFile(dest, 'utf-8');
    assertIncludes(content, 'HELLO WORLD', 'Le texte doit etre en majuscules');
    assertIncludes(content, 'THIS IS A TEST', 'Deuxieme ligne en majuscules');
    assertIncludes(content, 'STREAMS ARE POWERFUL', 'Troisieme ligne en majuscules');
  });

  // ── Test 3 : LineCounterTransform ────────────────────────────────────────
  await test('LineCounterTransform ajoute des numeros de ligne', async () => {
    const dest = join(tmpDir, 'numbered.txt');
    await pipeline(
      createReadStream(inputTxt),
      new LineCounterTransform(),
      createWriteStream(dest)
    );

    const content = await readFile(dest, 'utf-8');
    assertIncludes(content, '1: ', 'Doit contenir le numero de ligne 1');
    assertIncludes(content, '2: ', 'Doit contenir le numero de ligne 2');
    assertIncludes(content, '3: ', 'Doit contenir le numero de ligne 3');
    assertIncludes(content, 'Hello World', 'Le contenu original doit etre preserve');
  });

  // ── Test 4 : CsvToJsonTransform ──────────────────────────────────────────
  await test('CsvToJsonTransform convertit CSV en JSON', async () => {
    const dest = join(tmpDir, 'output.json');
    await pipeline(
      createReadStream(dataCsv),
      new CsvToJsonTransform(),
      createWriteStream(dest)
    );

    const content = await readFile(dest, 'utf-8');
    const lines = content.trim().split('\n');

    assert(lines.length >= 3, `Doit avoir au moins 3 lignes JSON, got ${lines.length}`);

    const first = JSON.parse(lines[0]);
    assertEqual(first.name, 'Laptop', 'Premier objet: name = Laptop');
    assertEqual(first.price, '999', 'Premier objet: price = 999');
    assertEqual(first.category, 'electronics', 'Premier objet: category = electronics');

    const second = JSON.parse(lines[1]);
    assertEqual(second.name, 'Mouse', 'Deuxieme objet: name = Mouse');
  });

  // ── Test 5 : processFile chaine les transforms ───────────────────────────
  await test('processFile chaine UpperCase + LineCounter', async () => {
    const dest = join(tmpDir, 'processed.txt');
    await processFile(inputTxt, dest);

    const content = await readFile(dest, 'utf-8');
    assertIncludes(content, '1: ', 'Doit contenir des numeros de ligne');
    assertIncludes(content, 'HELLO WORLD', 'Le texte doit etre en majuscules');
    assertIncludes(content, 'STREAMS ARE POWERFUL', 'Troisieme ligne en majuscules');
  });

  // ── Test 6 : CsvToJsonTransform avec petits chunks ──────────────────────
  await test('CsvToJsonTransform gere les chunks correctement', async () => {
    // Tester avec des donnees poussees manuellement
    const transform = new CsvToJsonTransform();
    const chunks = [];

    transform.on('data', (chunk) => chunks.push(chunk.toString()));

    // Simuler des chunks fractionnes
    await new Promise((resolve, reject) => {
      transform.write('name,age\nAli');
      transform.write('ce,30\nBob,25\n');
      transform.end(() => resolve());
      transform.on('error', reject);
    });

    const output = chunks.join('');
    const lines = output.trim().split('\n');
    assert(lines.length >= 2, `Doit avoir au moins 2 lignes, got ${lines.length}`);

    const first = JSON.parse(lines[0]);
    assertEqual(first.name, 'Alice', 'Doit reconstituer Alice malgre le split');
    assertEqual(first.age, '30', 'Age de Alice correct');
  });

} finally {
  // Nettoyage
  try {
    await rm(tmpDir, { recursive: true, force: true });
  } catch { /* ignore */ }
  summary();
}
