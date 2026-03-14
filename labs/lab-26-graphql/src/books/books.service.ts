import { Injectable } from '@nestjs/common';

export interface BookData {
  id: number;
  title: string;
  year: number;
  genre: string;
  authorId: number;
}

@Injectable()
export class BooksService {
  private nextId = 4;
  private books: BookData[] = [
    {
      id: 1,
      title: 'Les Misérables',
      year: 1862,
      genre: 'Roman',
      authorId: 1,
    },
    {
      id: 2,
      title: "L'Étranger",
      year: 1942,
      genre: 'Roman',
      authorId: 2,
    },
    {
      id: 3,
      title: 'Fondation',
      year: 1951,
      genre: 'Science-Fiction',
      authorId: 3,
    },
  ];

  findAll(): BookData[] {
    return this.books;
  }

  findOne(id: number): BookData | undefined {
    return this.books.find((b) => b.id === id);
  }

  search(term: string): BookData[] {
    const lower = term.toLowerCase();
    return this.books.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        b.genre.toLowerCase().includes(lower),
    );
  }

  create(input: {
    title: string;
    year: number;
    genre: string;
    authorId: number;
  }): BookData {
    const book: BookData = {
      id: this.nextId++,
      ...input,
    };
    this.books.push(book);
    return book;
  }

  update(
    id: number,
    input: { title?: string; year?: number; genre?: string },
  ): BookData | undefined {
    const book = this.books.find((b) => b.id === id);
    if (!book) return undefined;

    if (input.title !== undefined) book.title = input.title;
    if (input.year !== undefined) book.year = input.year;
    if (input.genre !== undefined) book.genre = input.genre;

    return book;
  }

  remove(id: number): boolean {
    const index = this.books.findIndex((b) => b.id === id);
    if (index === -1) return false;
    this.books.splice(index, 1);
    return true;
  }
}
