# Visualisations interactives

5 visualisations HTML animees pour comprendre les mécanismes internes de Node.js, Express et NestJS. Ouvrez-les directement dans votre navigateur — aucune dépendance requise.

| Visualisation | Description | Module associe |
|--------------|-------------|----------------|
| [Event Loop](./event-loop.html) | Call stack, task queue, microtask queue et event loop animes pas-a-pas | Module 01 |
| [Middleware Pipeline](./middleware-pipeline.html) | Pipeline de middleware Express : requête → middleware 1 → middleware 2 → ... → réponse | Modules 06-07 |
| [Dependency Injection](./dependency-injection.html) | Container DI NestJS : résolution de dépendances, scopes, injection hiérarchique | Module 11 |
| [ORM Query Flow](./orm-query-flow.html) | Pipeline ORM : entite/schema → query builder → SQL → résultat, TypeORM vs Prisma | Modules 14-17 |
| [NestJS Lifecycle](./nestjs-lifecycle.html) | Cycle de vie complet d'une requête NestJS : middleware → guard → interceptor → pipe → handler → interceptor → filter | Module 13 |

## Comment utiliser

1. Ouvrez le fichier `.html` directement dans votre navigateur
2. Utilisez les boutons **Play**, **Pause**, **Pas-a-pas** et **Reset**
3. Lisez le panneau d'explication en bas pour comprendre chaque étape
4. Essayez les différents scenarios via le menu deroulant ou les boutons

> **Conseil** : Utilisez ces visualisations pendant que vous lisez le module théorique correspondant.
