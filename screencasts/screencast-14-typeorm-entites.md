# Screencast 14 — TypeORM Entites & Relations

## Informations
- **Duree estimee** : 18-22 min
- **Module** : `modules/14-typeorm-entites-relations.md`
- **Lab associe** : `labs/lab-14-typeorm-entites/`
- **Prérequis** : Screencast 13 (Pipes, Guards & Interceptors), PostgreSQL installe

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] PostgreSQL demarre et accessible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — TypeORM et NestJS

> Salut ! Jusqu'a maintenant, nos donnees etaient stockees en mémoire. Un redemarrage du serveur et tout disparait. Aujourd'hui on va connecter une vraie base de donnees PostgreSQL avec TypeORM.

**Action** : Afficher le slide de titre "Module 14 — TypeORM Entites & Relations".

> TypeORM est un ORM (Object-Relational Mapping) TypeScript. Il permet de manipuler la base de donnees avec des classes TypeScript au lieu d'écrire du SQL brut. Chaque table est representee par une entite, chaque colonne par une propriété.

**Action** : Installer les dépendances.

```bash
npm install @nestjs/typeorm typeorm pg
```

### [03:00-07:00] Configuration et première entite

**Action** : Configurer TypeORM dans AppModule.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'nestcourse',
      autoLoadEntities: true,
      synchronize: true, // Attention : uniquement en dev !
    }),
    TasksModule,
    UsersModule,
  ],
})
export class AppModule {}
```

**Action** : Créer l'entite User.

```typescript
// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: 'user' })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> Chaque decorateur définit une colonne : `@PrimaryGeneratedColumn` pour l'ID auto-incremente, `@Column` pour les colonnes standard, `@CreateDateColumn` pour la date de création automatique. `select: false` sur le mot de passe signifie qu'il ne sera pas inclus dans les requêtes par defaut.

### [07:00-12:00] Relations — OneToMany, ManyToOne, ManyToMany

> La puissance d'un ORM, c'est la gestion des relations entre entites.

**Action** : Créer l'entite Task avec une relation vers User.

```typescript
// src/tasks/entities/task.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  done: boolean;

  @Column({ default: 'medium' })
  priority: string;

  @ManyToOne(() => User, user => user.tasks, { eager: false })
  author: User;

  @Column()
  authorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

**Action** : Ajouter la relation inverse dans User.

```typescript
// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @OneToMany(() => Task, task => task.author)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;
}
```

> `@ManyToOne` : plusieurs taches appartiennent à un utilisateur. `@OneToMany` : un utilisateur a plusieurs taches. C'est la relation la plus courante.

**Action** : Montrer une relation ManyToMany avec les tags.

```typescript
// src/tasks/entities/tag.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Task } from './task.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Task, task => task.tags)
  tasks: Task[];
}
```

```typescript
// Ajouter dans task.entity.ts
import { ManyToMany, JoinTable } from 'typeorm';
import { Tag } from './tag.entity';

// Dans la classe Task :
@ManyToMany(() => Tag, tag => tag.tasks)
@JoinTable()
tags: Tag[];
```

> `@ManyToMany` avec `@JoinTable` créé automatiquement une table de jointure. TypeORM géré tout.

### [12:00-16:00] Repository — CRUD avec TypeORM

**Action** : Configurer le module et utiliser le Repository.

```typescript
// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Tag } from './entities/tag.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Tag])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

```typescript
// src/tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async create(dto: CreateTaskDto, userId: number): Promise<Task> {
    const task = this.taskRepo.create({ ...dto, authorId: userId });
    return this.taskRepo.save(task);
  }

  async findAll(): Promise<Task[]> {
    return this.taskRepo.find({ relations: ['author', 'tags'] });
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['author', 'tags'],
    });
    if (!task) throw new NotFoundException(`Task #${id} non trouvee`);
    return task;
  }

  async update(id: number, dto: UpdateTaskDto): Promise<Task> {
    await this.taskRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.taskRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Task #${id} non trouvee`);
  }
}
```

**Action** : Tester les operations CRUD.

```bash
# Creer un utilisateur d'abord (via le UsersController)
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"pass"}' \
  http://localhost:3000/users

# Creer une tache
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Apprendre TypeORM","description":"Relations et queries","authorId":1}' \
  http://localhost:3000/tasks

# Lister avec relations
curl http://localhost:3000/tasks
```

### [16:00-19:30] Recap

> TypeORM connecte NestJS a PostgreSQL. Les entites decrivent les tables avec des decorateurs. Les relations (OneToMany, ManyToOne, ManyToMany) gerent les liens entre tables. Le Repository fournit les méthodes CRUD.

**Action** : Afficher le slide recap.

> Attention : `synchronize: true` est pratique en développement mais dangereux en production. En production, on utilise les migrations — c'est exactement ce qu'on verra au prochain screencast. Le lab est dans `labs/lab-14-typeorm-entites/`.

## Points d'attention pour l'enregistrement
- S'assurer que PostgreSQL tourne et que la base "nestcourse" existe
- Montrer les tables creees dans pgAdmin ou psql après le démarrage
- Insister sur synchronize:true qui est uniquement pour le dev
- Les relations eager vs lazy sont un concept important a clarifier
