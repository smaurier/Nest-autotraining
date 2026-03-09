// =============================================================================
// Lab 05 — Express CRUD (Exercice)
// =============================================================================
// Objectifs :
//   - Creer une application Express avec une API REST complete
//   - Gerer les routes CRUD pour "products"
//   - Valider les donnees et utiliser les bons status codes
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import { createTestRunner, startServer, httpGet, httpPost, httpPut, httpPatch, httpDelete } from '../test-utils.ts';

const { test, assert, assertEqual, summary } = createTestRunner('Lab 05 — Express CRUD');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

let products: Product[] = [];
let nextId = 1;

function resetDb(): void {
  products = [
    { id: 1, name: 'Laptop', price: 999.99, category: 'electronics' },
    { id: 2, name: 'Mouse', price: 29.99, category: 'electronics' },
    { id: 3, name: 'Desk', price: 249.99, category: 'furniture' },
    { id: 4, name: 'Chair', price: 189.99, category: 'furniture' },
  ];
  nextId = 5;
}

// =============================================================================
// TODO 1 : Creer l'application Express
// =============================================================================
// - Creer une app Express
// - Ajouter le middleware express.json() pour parser les corps JSON
//
// const app = express();
// app.use(express.json());

// TODO: Creer l'application Express ici
// const app = ???

// =============================================================================
// TODO 2 : GET /products
// =============================================================================
// Retourne la liste de tous les produits.
// Si le query parameter ?category= est present, filtrer par categorie.
//
// Exemples :
//   GET /products           -> tous les produits
//   GET /products?category=electronics -> seulement les electroniques
//
// Reponse : 200 avec le tableau de produits

// TODO: Implementer GET /products

// =============================================================================
// TODO 3 : GET /products/:id
// =============================================================================
// Retourne un produit par son ID.
// - Si le produit existe : 200 avec le produit
// - Si le produit n'existe pas : 404 avec { error: 'Product not found' }
//
// N'oubliez pas de convertir req.params.id en nombre avec parseInt()

// TODO: Implementer GET /products/:id

// =============================================================================
// TODO 4 : POST /products
// =============================================================================
// Cree un nouveau produit.
// - Valider que name (string), price (number) et category (string) sont presents
// - Si validation echoue : 400 avec { error: 'name, price, and category are required' }
// - Assigner un id auto-incremente
// - Reponse : 201 avec le produit cree

// TODO: Implementer POST /products

// =============================================================================
// TODO 5 : PUT /products/:id
// =============================================================================
// Remplace completement un produit existant.
// - Si le produit existe : le remplacer et retourner 200
// - Si le produit n'existe pas : 404

// TODO: Implementer PUT /products/:id

// =============================================================================
// TODO 6 : PATCH /products/:id
// =============================================================================
// Modifie partiellement un produit existant.
// - Fusionner les champs envoyes avec le produit existant
// - Si le produit existe : retourner 200 avec le produit modifie
// - Si le produit n'existe pas : 404

// TODO: Implementer PATCH /products/:id

// =============================================================================
// TODO 7 : DELETE /products/:id
// =============================================================================
// Supprime un produit.
// - Si le produit existe : le supprimer et retourner 204 (pas de body)
// - Si le produit n'existe pas : 404

// TODO: Implementer DELETE /products/:id

// =============================================================================
// TODO 8 : Middleware d'erreur
// =============================================================================
// Creer un middleware d'erreur centralise (4 arguments : err, req, res, next).
// - Loguer l'erreur (optionnel dans les tests)
// - Repondre avec le status de l'erreur (err.status) ou 500
// - Body : { error: err.message || 'Internal Server Error' }

// TODO: Implementer le middleware d'erreur

// =============================================================================
// TESTS
// =============================================================================

console.log('\n\uD83E\uDDEA Lab 05 — Express CRUD\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();

  // -- Test 1 : GET /products ----------------------------------------------
  await test('GET /products retourne tous les produits', async () => {
    const res = await httpGet(`${baseUrl}/products`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Product[];
    assertEqual(data.length, 4, 'Doit retourner 4 produits');
  });

  // -- Test 2 : GET /products?category= ------------------------------------
  await test('GET /products?category= filtre par categorie', async () => {
    const res = await httpGet(`${baseUrl}/products?category=electronics`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Product[];
    assertEqual(data.length, 2, 'Doit retourner 2 produits electronics');
    assert(data.every(p => p.category === 'electronics'), 'Tous doivent etre electronics');
  });

  // -- Test 3 : GET /products/:id ------------------------------------------
  await test('GET /products/:id retourne un produit', async () => {
    const res = await httpGet(`${baseUrl}/products/1`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Product;
    assertEqual(data.name, 'Laptop', 'Produit 1 est Laptop');
    assertEqual(data.price, 999.99, 'Prix correct');
  });

  // -- Test 4 : GET /products/:id -- 404 -----------------------------------
  await test('GET /products/:id retourne 404 si inexistant', async () => {
    const res = await httpGet(`${baseUrl}/products/999`);
    assertEqual(res.status, 404, 'Status 404');
    const data = res.json() as { error: string };
    assertEqual(data.error, 'Product not found', 'Message d\'erreur correct');
  });

  // -- Test 5 : POST /products ---------------------------------------------
  await test('POST /products cree un produit', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Monitor',
      price: 399.99,
      category: 'electronics',
    });
    assertEqual(res.status, 201, 'Status 201 Created');
    const data = res.json() as Product;
    assertEqual(data.name, 'Monitor', 'Nom correct');
    assertEqual(data.price, 399.99, 'Prix correct');
    assert(data.id, 'Doit avoir un id');
  });

  // -- Test 6 : POST /products -- validation --------------------------------
  await test('POST /products retourne 400 si champs manquants', async () => {
    const res = await httpPost(`${baseUrl}/products`, { name: 'Incomplete' });
    assertEqual(res.status, 400, 'Status 400 pour champs manquants');
  });

  // -- Test 7 : PUT /products/:id ------------------------------------------
  await test('PUT /products/:id remplace un produit', async () => {
    const res = await httpPut(`${baseUrl}/products/3`, {
      name: 'Standing Desk',
      price: 449.99,
      category: 'furniture',
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Product;
    assertEqual(data.name, 'Standing Desk', 'Nom remplace');
    assertEqual(data.price, 449.99, 'Prix remplace');
  });

  // -- Test 8 : PATCH /products/:id ----------------------------------------
  await test('PATCH /products/:id modifie partiellement', async () => {
    const res = await httpPatch(`${baseUrl}/products/4`, {
      price: 159.99,
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Product;
    assertEqual(data.price, 159.99, 'Prix modifie');
    assertEqual(data.name, 'Chair', 'Nom inchange');
    assertEqual(data.category, 'furniture', 'Categorie inchangee');
  });

  // -- Test 9 : DELETE /products/:id ---------------------------------------
  await test('DELETE /products/:id supprime un produit', async () => {
    const res = await httpDelete(`${baseUrl}/products/4`);
    assertEqual(res.status, 204, 'Status 204 No Content');

    const check = await httpGet(`${baseUrl}/products/4`);
    assertEqual(check.status, 404, 'Produit supprime');
  });

  // -- Test 10 : DELETE /products/:id -- 404 --------------------------------
  await test('DELETE /products/:id retourne 404 si inexistant', async () => {
    const res = await httpDelete(`${baseUrl}/products/999`);
    assertEqual(res.status, 404, 'Status 404 pour id inexistant');
  });

} finally {
  await close();
  summary();
}
