// =============================================================================
// Lab 02 — Modules et Systeme de Fichiers (Exercice)
// =============================================================================
// Objectifs :
//   - Lire et ecrire des fichiers JSON avec fs/promises
//   - Parser du CSV en objets TypeScript
//   - Parcourir un repertoire recursivement
//   - Lire des variables d'environnement
//   - Creer des modules ESM
// =============================================================================

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestRunner } from '../test-utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { test, assert, assertEqual, assertIncludes, assertGreaterThan, summary } = createTestRunner('Lab 02 — Modules & FS');

// =============================================================================
// TODO 1 : Implementer readJsonFile(filePath)
// =============================================================================
// Lit un fichier JSON et retourne l'objet JavaScript correspondant.
// - Utiliser readFile de fs/promises avec l'encodage 'utf-8'
// - Parser le contenu avec JSON.parse
//
// Exemple :
//   const users = await readJsonFile('./data/users.json');
//   // [{ id: 1, name: "Alice", ... }, ...]

async function readJsonFile(filePath: string): Promise<unknown> {
  // TODO: Lire le fichier et parser le JSON
  throw new Error('TODO: implementer readJsonFile()');
}

// =============================================================================
// TODO 2 : Implementer writeJsonFile(filePath, data)
// =============================================================================
// Ecrit un objet JavaScript dans un fichier JSON (formate avec 2 espaces).
// - Utiliser JSON.stringify avec indentation de 2 espaces
// - Utiliser writeFile de fs/promises
//
// Exemple :
//   await writeJsonFile('./output.json', { name: 'Alice' });
//   // Cree un fichier avec : { "name": "Alice" }

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  // TODO: Serialiser et ecrire le fichier JSON
  throw new Error('TODO: implementer writeJsonFile()');
}

// =============================================================================
// TODO 3 : Implementer parseCsv(csvString)
// =============================================================================
// Parse une chaine CSV en tableau d'objets.
// - La premiere ligne contient les noms de colonnes (headers)
// - Chaque ligne suivante est un enregistrement
// - Retourne un tableau d'objets ou les cles sont les headers
// - Ignorer les lignes vides
//
// Exemple :
//   parseCsv("name,age\nAlice,30\nBob,25")
//   // [{ name: "Alice", age: "30" }, { name: "Bob", age: "25" }]

function parseCsv(csvString: string): Record<string, string>[] {
  // TODO: Parser le CSV en tableau d'objets
  throw new Error('TODO: implementer parseCsv()');
}

// =============================================================================
// TODO 4 : Implementer findJsFiles(dirPath)
// =============================================================================
// Liste recursivement tous les fichiers .js dans un repertoire.
// - Utiliser readdir avec { withFileTypes: true }
// - Pour chaque entree : si c'est un repertoire, recurser ; si c'est un .js, l'ajouter
// - Retourner un tableau de chemins relatifs au dirPath initial
//
// Exemple :
//   await findJsFiles('./src')
//   // ['index.js', 'utils/helpers.js', 'utils/math.js']

async function findJsFiles(dirPath: string): Promise<string[]> {
  // TODO: Lister recursivement les fichiers .js
  throw new Error('TODO: implementer findJsFiles()');
}

// =============================================================================
// TODO 5 : Implementer getConfig(defaults)
// =============================================================================
// Lit des variables d'environnement et retourne un objet de configuration.
// - defaults est un objet { CLE: valeurParDefaut }
// - Pour chaque cle, chercher d'abord dans process.env
// - Si la variable n'existe pas dans process.env, utiliser la valeur par defaut
//
// Exemple :
//   process.env.PORT = '3000';
//   getConfig({ PORT: '8080', HOST: 'localhost' })
//   // { PORT: '3000', HOST: 'localhost' }

function getConfig(defaults: Record<string, string>): Record<string, string> {
  // TODO: Lire process.env avec des valeurs par defaut
  throw new Error('TODO: implementer getConfig()');
}

// =============================================================================
// TODO 6 : Implementer createSlugger()
// =============================================================================
// Factory function qui retourne un objet avec des methodes utilitaires :
//
// - slug(text) : convertit un texte en slug URL
//     "Hello World!" -> "hello-world"
//     Regles : minuscules, espaces -> tirets, retirer les caracteres speciaux,
//              retirer les tirets en debut/fin
//
// - camelCase(text) : convertit un texte en camelCase
//     "hello world" -> "helloWorld"
//     "my-variable-name" -> "myVariableName"
//
// - capitalize(text) : met la premiere lettre en majuscule
//     "hello" -> "Hello"

interface Slugger {
  slug: (text: string) => string;
  camelCase: (text: string) => string;
  capitalize: (text: string) => string;
}

function createSlugger(): Slugger {
  // TODO: Retourner un objet avec slug(), camelCase(), capitalize()
  throw new Error('TODO: implementer createSlugger()');
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n\uD83E\uDDEA Lab 02 — Modules et Systeme de Fichiers\n');

const dataDir = join(__dirname, 'data');
const tmpDir = join(__dirname, 'tmp');

// Setup : creer le repertoire temporaire
try {
  await mkdir(tmpDir, { recursive: true });
} catch { /* ignore */ }

try {
  // -- Test 1 : readJsonFile ------------------------------------------------
  await test('readJsonFile lit et parse un fichier JSON', async () => {
    const users = await readJsonFile(join(dataDir, 'users.json')) as { name: string; email: string }[];
    assert(Array.isArray(users), 'Le resultat doit etre un tableau');
    assertEqual(users.length, 3, 'Il doit y avoir 3 utilisateurs');
    assertEqual(users[0].name, 'Alice', 'Le premier utilisateur est Alice');
    assertEqual(users[1].email, 'bob@example.com', 'Email de Bob correct');
  });

  // -- Test 2 : writeJsonFile -----------------------------------------------
  await test('writeJsonFile ecrit un fichier JSON formate', async () => {
    const outputPath = join(tmpDir, 'output.json');
    const data = { name: 'Test', items: [1, 2, 3] };

    await writeJsonFile(outputPath, data);

    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content) as { name: string; items: number[] };
    assertEqual(parsed.name, 'Test', 'Le nom doit etre correct');
    assertEqual(parsed.items.length, 3, 'Les items doivent etre preserves');

    // Verifier l'indentation (2 espaces)
    assertIncludes(content, '  "name"', 'Le fichier doit etre indente avec 2 espaces');
  });

  // -- Test 3 : parseCsv ---------------------------------------------------
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

  // -- Test 4 : parseCsv gere les lignes vides ------------------------------
  await test('parseCsv ignore les lignes vides', async () => {
    const csv = 'a,b\n1,2\n\n3,4\n';
    const result = parseCsv(csv);
    assertEqual(result.length, 2, 'Les lignes vides sont ignorees');
    assertEqual(result[0].a, '1', 'Premiere valeur correcte');
    assertEqual(result[1].b, '4', 'Deuxieme valeur correcte');
  });

  // -- Test 5 : findJsFiles ------------------------------------------------
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

  // -- Test 6 : getConfig --------------------------------------------------
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

  // -- Test 7 : createSlugger -- slug ---------------------------------------
  await test('createSlugger.slug convertit en slug URL', async () => {
    const slugger = createSlugger();

    assertEqual(slugger.slug('Hello World'), 'hello-world', 'Espaces -> tirets');
    assertEqual(slugger.slug('Hello  World!'), 'hello-world', 'Caracteres speciaux retires');
    assertEqual(slugger.slug('  Bonjour le Monde  '), 'bonjour-le-monde', 'Trim les espaces');
    assertEqual(slugger.slug('Node.js & Express'), 'nodejs-express', 'Points et & retires');
  });

  // -- Test 8 : createSlugger -- camelCase et capitalize --------------------
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
