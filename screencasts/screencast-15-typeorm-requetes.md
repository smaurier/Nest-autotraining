# Screencast 15 — TypeORM Requetes & Migrations

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/15-typeorm-requetes-migrations.md`
- **Lab associe** : `labs/lab-15-typeorm-queries/`
- **Prerequis** : Screencast 14 (TypeORM Entites & Relations)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS avec TypeORM du screencast precedent
- [ ] PostgreSQL demarre avec des donnees de test
- [ ] Editeur de code ouvert

## Script

### [00:00-03:00] Introduction — Au-dela du CRUD basique

> Salut ! On a vu les bases de TypeORM : entites, relations et Repository CRUD. Aujourd'hui on va aller plus loin avec le QueryBuilder, les transactions et les migrations.

**Action** : Afficher le slide de titre "Module 15 — TypeORM Requetes & Migrations".

> Le Repository est parfait pour les operations simples. Mais quand on a besoin de requetes complexes — jointures, sous-requetes, aggregations — on utilise le QueryBuilder.

### [03:00-08:00] QueryBuilder — Requetes avancees

**Action** : Creer des methodes avec QueryBuilder dans le service.

```typescript
// src/tasks/tasks.service.ts
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  // Recherche avec filtres multiples
  async search(filters: {
    keyword?: string;
    priority?: string;
    done?: boolean;
    authorId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ data: Task[]; total: number }> {
    const qb = this.taskRepo.createQueryBuilder('task')
      .leftJoinAndSelect('task.author', 'author')
      .leftJoinAndSelect('task.tags', 'tags');

    if (filters.keyword) {
      qb.andWhere('(task.title ILIKE :kw OR task.description ILIKE :kw)', {
        kw: `%${filters.keyword}%`,
      });
    }

    if (filters.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    if (filters.done !== undefined) {
      qb.andWhere('task.done = :done', { done: filters.done });
    }

    if (filters.authorId) {
      qb.andWhere('task.authorId = :authorId', { authorId: filters.authorId });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;

    qb.orderBy('task.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // Statistiques avec aggregation
  async getStatistics() {
    return this.taskRepo.createQueryBuilder('task')
      .select('task.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN task.done THEN 1 ELSE 0 END)', 'completed')
      .groupBy('task.priority')
      .getRawMany();
  }
}
```

**Action** : Tester les requetes.

```bash
# Recherche avec filtres
curl "http://localhost:3000/tasks/search?keyword=learn&priority=high&page=1&limit=5"

# Statistiques
curl http://localhost:3000/tasks/statistics
```

> Le QueryBuilder construit la requete SQL de maniere fluide. `leftJoinAndSelect` charge les relations. `andWhere` ajoute des conditions. `skip/take` gere la pagination. `getManyAndCount` renvoie les donnees et le total.

### [08:00-12:00] Transactions — Integrite des donnees

> Les transactions garantissent que plusieurs operations sont atomiques : soit toutes reussissent, soit toutes echouent.

**Action** : Implementer une operation transactionnelle.

```typescript
// src/tasks/tasks.service.ts
import { DataSource } from 'typeorm';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    private dataSource: DataSource,
  ) {}

  async assignTasksToUser(taskIds: number[], userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const taskId of taskIds) {
        await queryRunner.manager.update(Task, taskId, { authorId: userId });
      }

      // Verifier que l'utilisateur existe
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('Utilisateur non trouve');
      }

      await queryRunner.commitTransaction();
      return { message: `${taskIds.length} taches assignees a ${user.name}` };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
```

> Si une operation echoue — par exemple si l'utilisateur n'existe pas — toutes les modifications sont annulees. C'est essentiel pour l'integrite des donnees.

**Action** : Tester la transaction.

```bash
# Assigner des taches
curl -X POST -H "Content-Type: application/json" \
  -d '{"taskIds":[1,2,3],"userId":1}' \
  http://localhost:3000/tasks/assign

# Avec un utilisateur inexistant (rollback)
curl -X POST -H "Content-Type: application/json" \
  -d '{"taskIds":[1,2,3],"userId":999}' \
  http://localhost:3000/tasks/assign
```

### [12:00-16:00] Migrations — Gerer l'evolution du schema

> En production, on ne peut pas utiliser `synchronize: true`. Les migrations permettent de versionner les changements de schema.

**Action** : Configurer les migrations.

```typescript
// src/data-source.ts
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'nestcourse',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
```

**Action** : Ajouter les scripts dans package.json.

```json
{
  "scripts": {
    "typeorm": "ts-node -r tsconfig-paths/register node_modules/typeorm/cli.js",
    "migration:generate": "npm run typeorm -- migration:generate -d src/data-source.ts",
    "migration:run": "npm run typeorm -- migration:run -d src/data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/data-source.ts"
  }
}
```

**Action** : Generer et executer une migration.

```bash
# Generer une migration a partir des changements d'entites
npm run migration:generate -- src/migrations/InitialSchema

# Executer les migrations
npm run migration:run
```

> La migration generee contient les requetes SQL `CREATE TABLE`, `ALTER TABLE`, etc. Elle a aussi une methode `down()` pour annuler les changements. C'est versionne avec git, reproductible, et securise.

**Action** : Montrer le contenu d'une migration generee.

```typescript
// src/migrations/xxxxx-InitialSchema.ts
export class InitialSchema1234567890 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "users" (...)`);
    await queryRunner.query(`CREATE TABLE "tasks" (...)`);
    await queryRunner.query(`CREATE TABLE "tags" (...)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

### [16:00-18:30] Recap

> Le QueryBuilder permet des requetes complexes avec filtres, pagination et aggregation. Les transactions garantissent l'atomicite des operations. Et les migrations versionnent l'evolution du schema.

**Action** : Afficher le slide recap.

> Desactivez `synchronize: true` et utilisez les migrations pour tout projet serieux. Le lab est dans `labs/lab-15-typeorm-queries/`. Vous allez pratiquer le QueryBuilder, les transactions et les migrations. Au prochain screencast, on decouvre Prisma !

## Points d'attention pour l'enregistrement
- Preparer des donnees de test dans la base avant de montrer les requetes
- Montrer le SQL genere par le QueryBuilder avec logging: true dans la config
- La demo de rollback doit clairement montrer que les donnees n'ont pas change
- Insister sur le danger de synchronize:true en production
