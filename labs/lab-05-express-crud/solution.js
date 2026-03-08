// =============================================================================
// Lab 05 — Express CRUD (Solution)
// =============================================================================
// Objectifs :
//   - Creer une application Express avec une API REST complete
//   - Gerer les routes CRUD pour "products"
//   - Valider les donnees et utiliser les bons status codes
// =============================================================================

import express from 'express';
import { createTestRunner, startServer, httpGet, httpPost, httpPut, httpPatch, httpDelete } from '../test-utils.js';

const { test, assert, assertEqual, summary } = createTestRunner('Lab 05 — Express CRUD');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

let products = [];
let nextId = 1;

function resetDb() {
  products = [
    { id: 1, name: 'Laptop', price: 999.99, category: 'electronics' },
    { id: 2, name: 'Mouse', price: 29.99, category: 'electronics' },
    { id: 3, name: 'Desk', price: 249.99, category: 'furniture' },
    { id: 4, name: 'Chair', price: 189.99, category: 'furniture' },
  ];
  nextId = 5;
}

// =============================================================================
// SOLUTION : Application Express
// =============================================================================

const app = express();
app.use(express.json());

// GET /products — avec filtre optionnel par categorie
app.get('/products', (req, res) => {
  const { category } = req.query;
  if (category) {
    const filtered = products.filter(p => p.category === category);
    return res.json(filtered);
  }
  res.json(products);
});

// GET /products/:id
app.get('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// POST /products
app.post('/products', (req, res) => {
  const { name, price, category } = req.body;

  if (!name || price === undefined || price === null || !category) {
    return res.status(400).json({ error: 'name, price, and category are required' });
  }

  const newProduct = { id: nextId++, name, price, category };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// PUT /products/:id
app.put('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { name, price, category } = req.body;
  products[index] = { id, name, price, category };
  res.json(products[index]);
});

// PATCH /products/:id
app.patch('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  products[index] = { ...products[index], ...req.body, id }; // id ne peut pas etre modifie
  res.json(products[index]);
});

// DELETE /products/:id
app.delete('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  products.splice(index, 1);
  res.status(204).send();
});

// Middleware d'erreur centralise
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 05 — Express CRUD\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();

  // ── Test 1 : GET /products ─────────────────────────────────────────────
  await test('GET /products retourne tous les produits', async () => {
    const res = await httpGet(`${baseUrl}/products`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.length, 4, 'Doit retourner 4 produits');
  });

  // ── Test 2 : GET /products?category= ──────────────────────────────────
  await test('GET /products?category= filtre par categorie', async () => {
    const res = await httpGet(`${baseUrl}/products?category=electronics`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.length, 2, 'Doit retourner 2 produits electronics');
    assert(data.every(p => p.category === 'electronics'), 'Tous doivent etre electronics');
  });

  // ── Test 3 : GET /products/:id ─────────────────────────────────────────
  await test('GET /products/:id retourne un produit', async () => {
    const res = await httpGet(`${baseUrl}/products/1`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.name, 'Laptop', 'Produit 1 est Laptop');
    assertEqual(data.price, 999.99, 'Prix correct');
  });

  // ── Test 4 : GET /products/:id — 404 ──────────────────────────────────
  await test('GET /products/:id retourne 404 si inexistant', async () => {
    const res = await httpGet(`${baseUrl}/products/999`);
    assertEqual(res.status, 404, 'Status 404');
    const data = res.json();
    assertEqual(data.error, 'Product not found', 'Message d\'erreur correct');
  });

  // ── Test 5 : POST /products ────────────────────────────────────────────
  await test('POST /products cree un produit', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Monitor',
      price: 399.99,
      category: 'electronics',
    });
    assertEqual(res.status, 201, 'Status 201 Created');
    const data = res.json();
    assertEqual(data.name, 'Monitor', 'Nom correct');
    assertEqual(data.price, 399.99, 'Prix correct');
    assert(data.id, 'Doit avoir un id');
  });

  // ── Test 6 : POST /products — validation ───────────────────────────────
  await test('POST /products retourne 400 si champs manquants', async () => {
    const res = await httpPost(`${baseUrl}/products`, { name: 'Incomplete' });
    assertEqual(res.status, 400, 'Status 400 pour champs manquants');
  });

  // ── Test 7 : PUT /products/:id ─────────────────────────────────────────
  await test('PUT /products/:id remplace un produit', async () => {
    const res = await httpPut(`${baseUrl}/products/3`, {
      name: 'Standing Desk',
      price: 449.99,
      category: 'furniture',
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.name, 'Standing Desk', 'Nom remplace');
    assertEqual(data.price, 449.99, 'Prix remplace');
  });

  // ── Test 8 : PATCH /products/:id ───────────────────────────────────────
  await test('PATCH /products/:id modifie partiellement', async () => {
    const res = await httpPatch(`${baseUrl}/products/4`, {
      price: 159.99,
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.price, 159.99, 'Prix modifie');
    assertEqual(data.name, 'Chair', 'Nom inchange');
    assertEqual(data.category, 'furniture', 'Categorie inchangee');
  });

  // ── Test 9 : DELETE /products/:id ──────────────────────────────────────
  await test('DELETE /products/:id supprime un produit', async () => {
    const res = await httpDelete(`${baseUrl}/products/4`);
    assertEqual(res.status, 204, 'Status 204 No Content');

    const check = await httpGet(`${baseUrl}/products/4`);
    assertEqual(check.status, 404, 'Produit supprime');
  });

  // ── Test 10 : DELETE /products/:id — 404 ───────────────────────────────
  await test('DELETE /products/:id retourne 404 si inexistant', async () => {
    const res = await httpDelete(`${baseUrl}/products/999`);
    assertEqual(res.status, 404, 'Status 404 pour id inexistant');
  });

} finally {
  await close();
  summary();
}
