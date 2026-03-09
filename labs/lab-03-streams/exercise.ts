// =============================================================================
// Lab 03 — Streams (Exercice)
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
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createTestRunner } from '../test-utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { test, assert, assertEqual, assertIncludes, summary } = createTestRunner('Lab 03 — Streams');

// =============================================================================
// TODO 1 : Implementer copyFile(src, dest)
// =============================================================================
// Copie un fichier source vers une destination en utilisant des streams.
// - Utiliser createReadStream pour lire
// - Utiliser createWriteStream pour ecrire
// - Utiliser pipeline() de 'node:stream/promises' pour les connecter
//
// Avantage par rapport a readFile/writeFile : ne charge pas tout en memoire.

async function copyFile(src: string, dest: string): Promise<void> {
  // TODO: Copier le fichier avec des streams et pipeline
  throw new Error('TODO: implementer copyFile()');
}

// =============================================================================
// TODO 2 : Creer UppercaseTransform
// =============================================================================
// Transform stream qui convertit tout le texte en majuscules.
// - Implementer la methode _transform(chunk, encoding, callback)
// - chunk est un Buffer : le convertir en string avec chunk.toString()
// - Pousser le resultat en majuscules avec this.push()
// - Appeler callback() quand c'est termine

class UppercaseTransform extends Transform {
  _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
    // TODO: Convertir le chunk en majuscules et le pousser
    throw new Error('TODO: implementer UppercaseTransform._transform()');
  }
}

// =============================================================================
// TODO 3 : Creer LineCounterTransform
// =============================================================================
// Transform stream qui compte les lignes et ajoute un numero devant chaque ligne.
// - Maintenir un compteur de lignes dans le constructeur (this.lineNumber = 0)
// - Decouper le chunk en lignes (split('\n'))
// - Ajouter le numero de ligne devant chaque ligne non-vide : "1: ligne..."
// - Reconstruire le texte avec les numeros de ligne
//
// ATTENTION : les chunks peuvent couper une ligne au milieu.
// Pour simplifier, on traite chaque chunk independamment.

class LineCounterTransform extends Transform {
  private lineNumber: number = 0;
  private buffer: string = '';

  constructor(options?: ConstructorParameters<typeof Transform>[0]) {
    super(options);
    // TODO: Initialiser le compteur de lignes
  }

  _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
    // TODO: Ajouter les numeros de ligne
    throw new Error('TODO: implementer LineCounterTransform._transform()');
  }
}

// =============================================================================
// TODO 4 : Creer CsvToJsonTransform
// =============================================================================
// Transform stream qui convertit des lignes CSV en objets JSON.
// - La premiere ligne contient les headers
// - Chaque ligne suivante est convertie en objet JSON (une ligne = un JSON + '\n')
// - Stocker les headers lors du premier chunk
// - Gerer le fait que les chunks peuvent couper au milieu d'une ligne
//   (accumuler un buffer des donnees incompletes)
//
// Exemple d'entree : "name,age\nAlice,30\nBob,25\n"
// Exemple de sortie : '{"name":"Alice","age":"30"}\n{"name":"Bob","age":"25"}\n'

class CsvToJsonTransform extends Transform {
  private headers: string[] | null = null;
  private buffer: string = '';

  constructor(options?: ConstructorParameters<typeof Transform>[0]) {
    super(options);
    // TODO: Initialiser headers et buffer
  }

  _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
    // TODO: Convertir les lignes CSV en JSON
    throw new Error('TODO: implementer CsvToJsonTransform._transform()');
  }

  _flush(callback: TransformCallback): void {
    // TODO: Traiter les donnees restantes dans le buffer
    throw new Error('TODO: implementer CsvToJsonTransform._flush()');
  }
}

// =============================================================================
// TODO 5 : Implementer processFile(src, dest)
// =============================================================================
// Chaine plusieurs transforms avec pipeline :
//   createReadStream(src) -> UppercaseTransform -> LineCounterTransform -> createWriteStream(dest)
//
// Le fichier de sortie doit contenir le texte en majuscules avec des numeros de ligne.

async function processFile(src: string, dest: string): Promise<void> {
  // TODO: Chainer les transforms avec pipeline
  throw new Error('TODO: implementer processFile()');
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n\uD83E\uDDEA Lab 03 — Streams\n');

const tmpDir = join(__dirname, 'tmp');

// Setup : creer les fichiers de test
await mkdir(tmpDir, { recursive: true });

const inputTxt = join(tmpDir, 'input.txt');
const dataCsv = join(tmpDir, 'data.csv');

await writeFile(inputTxt, 'Hello World\nThis is a test\nStreams are powerful\n', 'utf-8');
await writeFile(dataCsv, 'name,price,category\nLaptop,999,electronics\nMouse,29,peripherals\nDesk,249,furniture\n', 'utf-8');

try {
  // -- Test 1 : copyFile ---------------------------------------------------
  await test('copyFile copie un fichier avec des streams', async () => {
    const dest = join(tmpDir, 'copy.txt');
    await copyFile(inputTxt, dest);

    const original = await readFile(inputTxt, 'utf-8');
    const copied = await readFile(dest, 'utf-8');
    assertEqual(copied, original, 'Le contenu copie doit etre identique');
  });

  // -- Test 2 : UppercaseTransform -----------------------------------------
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

  // -- Test 3 : LineCounterTransform ---------------------------------------
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

  // -- Test 4 : CsvToJsonTransform -----------------------------------------
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

    const first = JSON.parse(lines[0]) as Record<string, string>;
    assertEqual(first.name, 'Laptop', 'Premier objet: name = Laptop');
    assertEqual(first.price, '999', 'Premier objet: price = 999');
    assertEqual(first.category, 'electronics', 'Premier objet: category = electronics');

    const second = JSON.parse(lines[1]) as Record<string, string>;
    assertEqual(second.name, 'Mouse', 'Deuxieme objet: name = Mouse');
  });

  // -- Test 5 : processFile chaine les transforms --------------------------
  await test('processFile chaine UpperCase + LineCounter', async () => {
    const dest = join(tmpDir, 'processed.txt');
    await processFile(inputTxt, dest);

    const content = await readFile(dest, 'utf-8');
    assertIncludes(content, '1: ', 'Doit contenir des numeros de ligne');
    assertIncludes(content, 'HELLO WORLD', 'Le texte doit etre en majuscules');
    assertIncludes(content, 'STREAMS ARE POWERFUL', 'Troisieme ligne en majuscules');
  });

  // -- Test 6 : CsvToJsonTransform avec petits chunks ----------------------
  await test('CsvToJsonTransform gere les chunks correctement', async () => {
    // Tester avec des donnees poussees manuellement
    const transform = new CsvToJsonTransform();
    const chunks: string[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

    // Simuler des chunks fractionnes
    await new Promise<void>((resolve, reject) => {
      transform.write('name,age\nAli');
      transform.write('ce,30\nBob,25\n');
      transform.end(() => resolve());
      transform.on('error', reject);
    });

    const output = chunks.join('');
    const lines = output.trim().split('\n');
    assert(lines.length >= 2, `Doit avoir au moins 2 lignes, got ${lines.length}`);

    const first = JSON.parse(lines[0]) as Record<string, string>;
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
