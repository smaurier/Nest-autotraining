import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

export interface Comment {
  id: number;
  articleId: number;
  content: string;
}

export interface Article {
  id: number;
  title: string;
  content: string;
  tags: string[];
  comments: Comment[];
  createdAt: Date;
}

@Injectable()
export class ArticlesService {
  // TODO: Declare a private array to store articles
  // Hint: private articles: Article[] = [];

  // TODO: Declare a private counter for auto-incrementing IDs
  // Hint: private idCounter = 0;

  // TODO: Implement findAll()
  // It should return all articles
  findAll(): Article[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // It should return a single article by its id
  // If the article is not found, throw a NotFoundException
  findOne(id: number): Article {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(createArticleDto)
  // It should create a new article with auto-incremented id
  // Set defaults: content = '', tags = [], comments = [], createdAt = new Date()
  create(createArticleDto: CreateArticleDto): Article {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement update(id, updateArticleDto)
  // It should find the article and update only the provided fields
  update(id: number, updateArticleDto: UpdateArticleDto): Article {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement remove(id)
  // It should find the article and remove it from the array
  remove(id: number): void {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findComments(articleId)
  // It should return the comments array of the article
  findComments(articleId: number): Comment[] {
    throw new Error('TODO: Not implemented');
  }
}
