import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Books GraphQL API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const graphql = (query: string) =>
    request(app.getHttpServer()).post('/graphql').send({ query });

  // ─── Queries ───────────────────────────────────────────────

  it('should return all books with authors', async () => {
    const res = await graphql(`
      {
        books {
          id
          title
          year
          genre
          author {
            id
            name
            nationality
          }
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.books).toBeInstanceOf(Array);
    expect(res.body.data.books.length).toBeGreaterThanOrEqual(3);

    const book = res.body.data.books[0];
    expect(book).toHaveProperty('id');
    expect(book).toHaveProperty('title');
    expect(book).toHaveProperty('year');
    expect(book).toHaveProperty('genre');
    expect(book.author).toHaveProperty('name');
    expect(book.author).toHaveProperty('nationality');
  });

  it('should return a single book by id', async () => {
    const res = await graphql(`
      {
        book(id: 1) {
          id
          title
          author {
            name
          }
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.book).toBeDefined();
    expect(res.body.data.book.id).toBe(1);
    expect(res.body.data.book.title).toBe('Les Misérables');
    expect(res.body.data.book.author.name).toBe('Victor Hugo');
  });

  it('should return null for a non-existent book', async () => {
    const res = await graphql(`
      {
        book(id: 999) {
          id
          title
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.book).toBeNull();
  });

  it('should search books by term', async () => {
    const res = await graphql(`
      {
        searchBooks(term: "roman") {
          id
          title
          genre
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.searchBooks).toBeInstanceOf(Array);
    expect(res.body.data.searchBooks.length).toBeGreaterThanOrEqual(2);
    res.body.data.searchBooks.forEach((book: any) => {
      expect(book.genre.toLowerCase()).toContain('roman');
    });
  });

  it('should return empty array when search finds nothing', async () => {
    const res = await graphql(`
      {
        searchBooks(term: "zzzznotfound") {
          id
          title
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.searchBooks).toEqual([]);
  });

  // ─── Mutations ─────────────────────────────────────────────

  it('should create a new book', async () => {
    const res = await graphql(`
      mutation {
        createBook(input: {
          title: "Le Petit Prince"
          year: 1943
          genre: "Conte"
          authorId: 1
        }) {
          id
          title
          year
          genre
          author {
            name
          }
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.createBook).toBeDefined();
    expect(res.body.data.createBook.title).toBe('Le Petit Prince');
    expect(res.body.data.createBook.year).toBe(1943);
    expect(res.body.data.createBook.genre).toBe('Conte');
    expect(res.body.data.createBook.id).toBeDefined();
    expect(res.body.data.createBook.author.name).toBe('Victor Hugo');
  });

  it('should update an existing book', async () => {
    const res = await graphql(`
      mutation {
        updateBook(id: 2, input: {
          title: "L'Étranger (édition révisée)"
          year: 2000
        }) {
          id
          title
          year
          genre
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.updateBook).toBeDefined();
    expect(res.body.data.updateBook.id).toBe(2);
    expect(res.body.data.updateBook.title).toBe(
      "L'Étranger (édition révisée)",
    );
    expect(res.body.data.updateBook.year).toBe(2000);
    // genre should remain unchanged
    expect(res.body.data.updateBook.genre).toBe('Roman');
  });

  it('should return null when updating a non-existent book', async () => {
    const res = await graphql(`
      mutation {
        updateBook(id: 999, input: { title: "Ghost" }) {
          id
          title
        }
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.updateBook).toBeNull();
  });

  it('should delete an existing book', async () => {
    const res = await graphql(`
      mutation {
        deleteBook(id: 3)
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.deleteBook).toBe(true);

    // Verify it's gone
    const check = await graphql(`
      {
        book(id: 3) {
          id
        }
      }
    `);
    expect(check.body.data.book).toBeNull();
  });

  it('should return false when deleting a non-existent book', async () => {
    const res = await graphql(`
      mutation {
        deleteBook(id: 999)
      }
    `);

    expect(res.status).toBe(200);
    expect(res.body.data.deleteBook).toBe(false);
  });
});
