import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { Book } from './book.model';
import { Author } from './author.model';
import { BooksService } from '../src/books/books.service';
import { AuthorsService } from '../src/books/authors.service';
import { CreateBookInput } from './create-book.input';
import { UpdateBookInput } from './update-book.input';

@Resolver(() => Book)
export class BooksResolver {
  constructor(
    private readonly booksService: BooksService,
    private readonly authorsService: AuthorsService,
  ) {}

  @Query(() => [Book])
  books() {
    return this.booksService.findAll();
  }

  @Query(() => Book, { nullable: true })
  book(@Args('id', { type: () => Int }) id: number) {
    return this.booksService.findOne(id);
  }

  @Query(() => [Book])
  searchBooks(@Args('term') term: string) {
    return this.booksService.search(term);
  }

  @Mutation(() => Book)
  createBook(@Args('input') input: CreateBookInput) {
    return this.booksService.create(input);
  }

  @Mutation(() => Book, { nullable: true })
  updateBook(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: UpdateBookInput,
  ) {
    return this.booksService.update(id, input);
  }

  @Mutation(() => Boolean)
  deleteBook(@Args('id', { type: () => Int }) id: number) {
    return this.booksService.remove(id);
  }

  @ResolveField(() => Author)
  author(@Parent() book: Book) {
    return this.authorsService.findOne(book.authorId);
  }
}
