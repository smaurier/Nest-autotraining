import { Injectable } from '@nestjs/common';

export interface AuthorData {
  id: number;
  name: string;
  nationality: string;
}

@Injectable()
export class AuthorsService {
  private authors: AuthorData[] = [
    { id: 1, name: 'Victor Hugo', nationality: 'Français' },
    { id: 2, name: 'Albert Camus', nationality: 'Français' },
    { id: 3, name: 'Isaac Asimov', nationality: 'Américain' },
  ];

  findOne(id: number): AuthorData | undefined {
    return this.authors.find((a) => a.id === id);
  }

  findAll(): AuthorData[] {
    return this.authors;
  }
}
