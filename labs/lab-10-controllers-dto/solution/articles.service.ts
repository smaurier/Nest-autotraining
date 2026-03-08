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
  private articles: Article[] = [];
  private idCounter = 0;

  findAll(): Article[] {
    return this.articles;
  }

  findOne(id: number): Article {
    const article = this.articles.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    return article;
  }

  create(createArticleDto: CreateArticleDto): Article {
    const article: Article = {
      id: ++this.idCounter,
      title: createArticleDto.title,
      content: createArticleDto.content || '',
      tags: createArticleDto.tags || [],
      comments: [],
      createdAt: new Date(),
    };
    this.articles.push(article);
    return article;
  }

  update(id: number, updateArticleDto: UpdateArticleDto): Article {
    const article = this.findOne(id);
    Object.assign(article, updateArticleDto);
    return article;
  }

  remove(id: number): void {
    const article = this.findOne(id);
    const index = this.articles.indexOf(article);
    this.articles.splice(index, 1);
  }

  findComments(articleId: number): Comment[] {
    const article = this.findOne(articleId);
    return article.comments;
  }
}
