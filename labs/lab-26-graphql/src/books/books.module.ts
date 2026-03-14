import { Module } from '@nestjs/common';
import { BooksResolver } from './books.resolver';
import { BooksService } from './books.service';
import { AuthorsService } from './authors.service';

@Module({
  providers: [BooksResolver, BooksService, AuthorsService],
})
export class BooksModule {}
