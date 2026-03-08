// =============================================================================
// Lab 02 — Modules et Systeme de Fichiers (Solution)
// =============================================================================
// Objectifs :
//   - Lire et ecrire des fichiers JSON avec fs/promises
//   - Parser du CSV en objets JavaScript
//   - Parcourir un repertoire recursivement
//   - Lire des variables d'environnement
//   - Creer des modules ESM
// =============================================================================

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestRunner } from '../test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { test, assert, assertEqual, assertIncludes, assertGreaterThan, summary } = createTestRunner('Lab 02 — Modules & FS');

// =============================================================================
// SOLUTION 1 : readJsonFile(filePath)
// =============================================================================

async function readJsonFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// =============================================================================
// SOLUTION 2 : writeJsonFile(filePath, data)
// =============================================================================

async function writeJsonFile(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  await writeFile(filePath, json, 'utf-8');
}

// =============================================================================
// SOLUTION 3 : parseCsv(csvString)
// =============================================================================

function parseCsv(csvString) {
  const lines = csvString.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
}

// =============================================================================
// SOLUTION 4 : findJsFiles(dirPath)
// =============================================================================

async function findJsFiles(dirPath, basePath = dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findJsFiles(fullPath, basePath);
      files.push(...subFiles);
    } else if (entry.name.endsWith('.js')) {
      // Chemin relatif au repertoire de base
      const relativePath = fullPath.slice(basePath.length + 1).replace(/\\/g, '/');
      files.push(relativePath);
    }
  }

  return files;
}

// =============================================================================
// SOLUTION 5 : getConfig(defaults)
// =============================================================================

function getConfig(defaults) {
  const config = {};
  for (const [key, defaultValue] of Object.entries(defaults)) {
    config[key] = process.env[key] !== undefined ? process.env[key] : defaultValue;
  }
  return config;
}

// =============================================================================
// SOLUTION 6 : createSlugger()
// =============================================================================

function createSlugger() {
  return {
    slug(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')  // retirer caracteres speciaux
        .replace(/\s+/g, '-')           // espaces → tirets
        .replace(/-+/g, '-')            // tirets multiples → un seul
        .replace(/^-|-$/g, '');          // retirer tirets en debut/fin
    },

    camelCase(text) {
      const words = text.split(/[\s-]+/);
      return words
        .map((word, i) => {
          if (i === 0) return word.toLowerCase();
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
    },

    capitalize(text) {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1);
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 02 — Modules et Systeme de Fichiers\n');

const dataDir = join(__dirname, 'data');
const tmpDir = join(__dirname, 'tmp');

// Setup : creer le repertoire temporaire
try {
  await mkdir(tmpDir, { recursive: true });
} catch { /* ignore */ }

try {
  // ── Test 1 : readJsonFile ─────────────────────────────────────────────────
  await test('readJsonFile lit et parse un fichier JSON', async () => {
    const users = await readJsonFile(join(dataDir, 'users.json'));
    assert(Array.isArray(users), 'Le resultat doit etre un tableau');
    assertEqual(users.length, 3, 'Il doit y avoir 3 utilisateurs');
    assertEqual(users[0].name, 'Alice', 'Le premier utilisateur est Alice');
    assertEqual(users[1].email, 'bob@example.com', 'Email de Bob correct');
  });

  // ── Test 2 : writeJsonFile ────────────────────────────────────────────────
  await test('writeJsonFile ecrit un fichier JSON formate', async () => {
    const outputPath = join(tmpDir, 'output.json');
    const data = { name: 'Test', items: [1, 2, 3] };

    await writeJsonFile(outputPath, data);

    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content);
    assertEqual(parsed.name, 'Test', 'Le nom doit etre correct');
    assertEqual(parsed.items.length, 3, 'Les items doivent etre preserves');

    // Verifier l'indentation (2 espaces)
    assertIncludes(content, '  "name"', 'Le fichier doit etre indente avec 2 espaces');
  });

  // ── Test 3 : parseCsv ────────────────────────────────────────────────────
  await test('parseCsv parse une chaine CSV en objets', async () => {
    const csvContent = await readFile(join(dataDir, 'products.csv'), 'utf-8');
    const products = parseCsv(csvContent);

    assert(Array.isArray(products), 'Le resultat doit etre un tableau');
    assertEqual(products.length, 5, 'Il doit y avoir 5 produits');
    assertEqual(products[0].name, 'Laptop', 'Premier produit: Laptop');
    assertEqual(products[0].price, '999.99', 'Prix du Laptop: 999.99');
    assertEqual(products[0].category, 'electronics', 'Categorie: electronics');
    assertEqual(products[3].name, 'Chair', 'Quatrieme produit: Chair');
  });

  // ── Test 4 : parseCsv gere les lignes vides ──────────────────────────────
  await test('parseCsv ignore les lignes vides', async () => {
    const csv = 'a,b\n1,2\n\n3,4\n';
    const result = parseCsv(csv);
    assertEqual(result.length, 2, 'Les lignes vides sont ignorees');
    assertEqual(result[0].a, '1', 'Premiere valeur correcte');
    assertEqual(result[1].b, '4', 'Deuxieme valeur correcte');
  });

  // ── Test 5 : findJsFiles ─────────────────────────────────────────────────
  await test('findJsFiles liste les fichiers .js recursivement', async () => {
    // Creer une structure de test
    const testDir = join(tmpDir, 'find-test');
    await mkdir(join(testDir, 'sub'), { recursive: true });
    await writeFile(join(testDir, 'index.js'), '// test');
    await writeFile(join(testDir, 'style.css'), '/* css */');
    await writeFile(join(testDir, 'sub', 'helper.js'), '// helper');
    await writeFile(join(testDir, 'sub', 'data.json'), '{}');

    const jsFiles = await findJsFiles(testDir);

    assert(Array.isArray(jsFiles), 'Le resultat doit etre un tableau');
    assertEqual(jsFiles.length, 2, 'Il doit y avoir 2 fichiers .js');
    assert(
      jsFiles.some(f => f === 'index.js' || f.endsWith('/index.js') || f.endsWith('\\index.js')),
      'Doit contenir index.js'
    );
    assert(
      jsFiles.some(f => f.includes('helper.js')),
      'Doit contenir sub/helper.js'
    );
  });

  // ── Test 6 : getConfig ───────────────────────────────────────────────────
  await test('getConfig lit process.env avec des defauts', async () => {
    // Setup
    process.env.TEST_PORT = '4000';
    process.env.TEST_HOST = '0.0.0.0';

    const config = getConfig({
      TEST_PORT: '3000',
      TEST_HOST: 'localhost',
      TEST_DB: 'mydb',
    });

    assertEqual(config.TEST_PORT, '4000', 'PORT doit venir de process.env');
    assertEqual(config.TEST_HOST, '0.0.0.0', 'HOST doit venir de process.env');
    assertEqual(config.TEST_DB, 'mydb', 'DB doit utiliser la valeur par defaut');

    // Cleanup
    delete process.env.TEST_PORT;
    delete process.env.TEST_HOST;
  });

  // ── Test 7 : createSlugger — slug ────────────────────────────────────────
  await test('createSlugger.slug convertit en slug URL', async () => {
    const slugger = createSlugger();

    assertEqual(slugger.slug('Hello World'), 'hello-world', 'Espaces → tirets');
    assertEqual(slugger.slug('Hello  World!'), 'hello-world', 'Caracteres speciaux retires');
    assertEqual(slugger.slug('  Bonjour le Monde  '), 'bonjour-le-monde', 'Trim les espaces');
    assertEqual(slugger.slug('Node.js & Express'), 'nodejs-express', 'Points et & retires');
  });

  // ── Test 8 : createSlugger — camelCase et capitalize ─────────────────────
  await test('createSlugger.camelCase et capitalize fonctionnent', async () => {
    const slugger = createSlugger();

    assertEqual(slugger.camelCase('hello world'), 'helloWorld', 'Espaces en camelCase');
    assertEqual(slugger.camelCase('my-variable-name'), 'myVariableName', 'Tirets en camelCase');
    assertEqual(slugger.camelCase('one'), 'one', 'Un seul mot');

    assertEqual(slugger.capitalize('hello'), 'Hello', 'Premiere lettre en majuscule');
    assertEqual(slugger.capitalize('HELLO'), 'HELLO', 'Garde le reste inchange');
    assertEqual(slugger.capitalize(''), '', 'Chaine vide');
  });

} finally {
  // Nettoyage du repertoire temporaire
  try {
    await rm(tmpDir, { recursive: true, force: true });
  } catch { /* ignore */ }
  summary();
}
