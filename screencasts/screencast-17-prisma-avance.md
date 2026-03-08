# Screencast 17 — Prisma Avance & Comparaison

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/17-prisma-avance-comparaison.md`
- **Lab associe** : `labs/lab-17-prisma-avance/`
- **Prerequis** : Screencast 16 (Prisma Schema & Client)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS avec Prisma du screencast precedent
- [ ] PostgreSQL avec des donnees de test
- [ ] Editeur de code ouvert

## Script

### [00:00-02:30] Introduction — Aller plus loin avec Prisma

> Salut ! On a vu les bases de Prisma : schema, client, CRUD. Aujourd'hui on va explorer les fonctionnalites avancees : nested writes, pagination, transactions. Et on va comparer Prisma et TypeORM pour vous aider a choisir.

**Action** : Afficher le slide de titre "Module 17 — Prisma Avance & Comparaison".

### [02:30-06:00] Nested writes — Creer des relations en une requete

> Les nested writes permettent de creer ou connecter des entites liees en une seule operation.

**Action** : Demontrer les nested writes.

```typescript
// src/tasks/tasks.service.ts
async createWithTags(dto: CreateTaskWithTagsDto) {
  return this.prisma.task.create({
    data: {
      title: dto.title,
      description: dto.description,
      author: { connect: { id: dto.authorId } },
      tags: {
        connectOrCreate: dto.tags.map(tagName => ({
          where: { name: tagName },
          create: { name: tagName },
        })),
      },
    },
    include: { author: true, tags: true },
  });
}

// Creer un utilisateur avec ses taches en une seule requete
async createUserWithTasks(data: any) {
  return this.prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.password,
      tasks: {
        create: [
          { title: 'Premiere tache', priority: 'high' },
          { title: 'Deuxieme tache', priority: 'medium' },
        ],
      },
    },
    include: { tasks: true },
  });
}
```

**Action** : Tester les nested writes.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Tache avec tags","authorId":1,"tags":["urgent","backend"]}' \
  http://localhost:3000/tasks/with-tags
```

> `connectOrCreate` est genial : si le tag existe, il le connecte. Sinon, il le cree. Tout ca en une seule requete, dans une seule transaction.

### [06:00-10:00] Pagination et filtrage avance

**Action** : Implementer la pagination cursor-based et offset-based.

```typescript
// src/tasks/tasks.service.ts

// Pagination offset-based (classique)
async findPaginated(page: number, limit: number, filters?: {
  search?: string;
  priority?: string;
  done?: boolean;
}) {
  const where: any = {};

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters?.priority) where.priority = filters.priority;
  if (filters?.done !== undefined) where.done = filters.done;

  const [data, total] = await Promise.all([
    this.prisma.task.findMany({
      where,
      include: { author: { select: { id: true, name: true } }, tags: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.task.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Pagination cursor-based (performante)
async findWithCursor(cursor?: number, limit = 10) {
  const tasks = await this.prisma.task.findMany({
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { id: 'asc' },
    include: { author: true },
  });

  const hasMore = tasks.length > limit;
  const data = hasMore ? tasks.slice(0, -1) : tasks;

  return {
    data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
}
```

**Action** : Tester la pagination.

```bash
# Pagination classique
curl "http://localhost:3000/tasks?page=1&limit=5&search=prisma"

# Pagination cursor
curl "http://localhost:3000/tasks/cursor?limit=5"
curl "http://localhost:3000/tasks/cursor?cursor=5&limit=5"
```

> La pagination cursor-based est plus performante pour les grands volumes. Au lieu de `skip` (qui doit parcourir les lignes), on utilise un curseur qui pointe directement vers le bon enregistrement.

### [10:00-13:00] Transactions Prisma

**Action** : Implementer des transactions.

```typescript
// Transaction interactive
async transferTask(taskId: number, fromUserId: number, toUserId: number) {
  return this.prisma.$transaction(async (tx) => {
    // Verifier que la tache appartient bien a fromUser
    const task = await tx.task.findFirst({
      where: { id: taskId, authorId: fromUserId },
    });
    if (!task) throw new NotFoundException('Tache non trouvee pour cet utilisateur');

    // Verifier que toUser existe
    const toUser = await tx.user.findUnique({ where: { id: toUserId } });
    if (!toUser) throw new NotFoundException('Utilisateur destinataire non trouve');

    // Transferer
    return tx.task.update({
      where: { id: taskId },
      data: { authorId: toUserId },
      include: { author: true },
    });
  });
}

// Transaction batch (sequentielle)
async bulkCreateTasks(tasks: CreateTaskDto[], authorId: number) {
  return this.prisma.$transaction(
    tasks.map(task =>
      this.prisma.task.create({
        data: { ...task, authorId },
      })
    )
  );
}
```

> Prisma propose deux styles de transactions : les transactions interactives (avec un callback et `tx`) et les transactions batch (un tableau de requetes). Les deux sont atomiques.

### [13:00-16:00] Comparaison TypeORM vs Prisma

> La grande question : lequel choisir ?

**Action** : Afficher le tableau comparatif.

```
| Critere              | TypeORM                    | Prisma                     |
|----------------------|----------------------------|----------------------------|
| Approche             | Code-first (decorateurs)   | Schema-first (DSL)         |
| Type safety          | Partiel                    | Complet (genere)           |
| Relations            | Decorateurs sur classes    | Schema declaratif          |
| Migrations           | CLI + generate             | prisma migrate dev         |
| Requetes complexes   | QueryBuilder               | Filtres type-safe          |
| Courbe apprentissage | Moderee                    | Douce                      |
| Maturite             | Mature, large ecosysteme   | Plus recent, en croissance |
| Debug SQL            | logging: true              | $queryRaw, logs            |
```

> TypeORM est ideal si vous venez du monde Java/Hibernate ou si vous avez besoin du pattern Active Record. Prisma est excellent pour les nouveaux projets grace a son type safety complet et sa DX (Developer Experience) superieure.

> En pratique, les deux fonctionnent tres bien avec NestJS. Choisissez celui qui correspond le mieux a votre equipe et votre projet.

### [16:00-17:30] Recap

> Prisma offre des nested writes pour creer des relations en une requete, deux modes de pagination, des transactions interactives et batch. Compare a TypeORM, il est plus type-safe mais moins flexible pour le SQL brut.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-17-prisma-avance/`. Vous allez pratiquer les nested writes, la pagination et les transactions. Au prochain screencast, on passe au testing NestJS !

## Points d'attention pour l'enregistrement
- Avoir suffisamment de donnees de test pour que la pagination soit visible
- Montrer l'autocompletion Prisma vs TypeORM cote a cote si possible
- La demo de transaction doit montrer le rollback clairement
- Le tableau comparatif doit rester objectif — les deux outils sont valables
