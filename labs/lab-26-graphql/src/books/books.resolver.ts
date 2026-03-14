import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { Book } from './models/book.model';
import { Author } from './models/author.model';
import { BooksService } from './books.service';
import { AuthorsService } from './authors.service';
import { CreateBookInput } from './dto/create-book.input';
import { UpdateBookInput } from './dto/update-book.input';

// TODO: Add @Resolver(() => Book) decorator
export class BooksResolver {
  constructor(
    private readonly booksService: BooksService,
    private readonly authorsService: AuthorsService,
  ) {}

  // TODO: Add @Query(() => [Book]) decorator
  // This query returns all books
  books() {
    throw new Error('TODO: call this.booksService.findAll()');
  }

  // TODO: Add @Query(() => Book, { nullable: true }) decorator
  // Add @Args('id', { type: () => Int }) to the parameter
  book(id: number) {
    throw new Error('TODO: call this.booksService.findOne(id)');
  }

  // TODO: Add @Query(() => [Book]) decorator
  // Add @Args('term') to the parameter
  searchBooks(term: string) {
    throw new Error('TODO: call this.booksService.search(term)');
  }

  // TODO: Add @Mutation(() => Book) decorator
  // Add @Args('input') to the parameter
  createBook(input: CreateBookInput) {
    throw new Error('TODO: call this.booksService.create(input)');
  }

  // TODO: Add @Mutation(() => Book, { nullable: true }) decorator
  // Add @Args('id', { type: () => Int }) and @Args('input') to the parameters
  updateBook(id: number, input: UpdateBookInput) {
    throw new Error('TODO: call this.booksService.update(id, input)');
  }

  // TODO: Add @Mutation(() => Boolean) decorator
  // Add @Args('id', { type: () => Int }) to the parameter
  deleteBook(id: number) {
    throw new Error('TODO: call this.booksService.remove(id)');
  }

  // TODO: Add @ResolveField(() => Author) decorator
  // Add @Parent() book: Book to the parameter
  // This resolves the 'author' field on a Book by looking up the authorId
  author(book: Book) {
    throw new Error(
      'TODO: call this.authorsService.findOne(book.authorId)',
    );
  }
}
