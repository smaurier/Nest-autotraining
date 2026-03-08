import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Node.js, Express & NestJS Course',
  description: 'Formation complète Node.js, Express & NestJS : event loop, modules, streams, middleware, DI, TypeORM, Prisma, testing, auth, WebSockets (débutant → expert)',
  lang: 'fr-FR',
  srcDir: '.',

  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Modules', link: '/modules/00-prerequis-et-monde-backend' },
      { text: 'Labs', link: '/labs/lab-01-event-loop/README' },
      { text: 'Quizzes', link: '/quizzes/' },
      { text: 'Visualisations', link: '/visualizations/' },
      { text: 'Glossaire', link: '/glossaire' }
    ],

    sidebar: {
      '/modules/': [
        {
          text: 'Modules',
          items: [
            { text: '00 — Prerequis & Le monde du backend', link: '/modules/00-prerequis-et-monde-backend' },
            { text: '01 — Node.js — Event Loop & Asynchrone', link: '/modules/01-nodejs-event-loop' },
            { text: '02 — Node.js — Modules, FS & Process', link: '/modules/02-nodejs-modules-et-fs' },
            { text: '03 — Node.js — Streams & Buffers', link: '/modules/03-nodejs-streams-et-buffers' },
            { text: '04 — Node.js — Serveur HTTP natif', link: '/modules/04-nodejs-serveur-http' },
            { text: '05 — Express — Fondamentaux', link: '/modules/05-express-fondamentaux' },
            { text: '06 — Express — Middleware & Architecture', link: '/modules/06-express-middleware' },
            { text: '07 — Express — Validation & Gestion d\'erreurs', link: '/modules/07-express-validation-erreurs' },
            { text: '08 — Express — Authentification & Securite', link: '/modules/08-express-auth-securite' },
            { text: '09 — NestJS — Introduction & Premiers pas', link: '/modules/09-nestjs-introduction' },
            { text: '10 — NestJS — Controllers & Routing', link: '/modules/10-nestjs-controllers' },
            { text: '11 — NestJS — Providers & Injection de Dependances', link: '/modules/11-nestjs-providers-di' },
            { text: '12 — NestJS — Modules & Architecture', link: '/modules/12-nestjs-modules' },
            { text: '13 — NestJS — Pipes, Guards, Interceptors & Filters', link: '/modules/13-nestjs-pipes-guards-interceptors' },
            { text: '14 — TypeORM — Entites & Relations', link: '/modules/14-typeorm-entites-relations' },
            { text: '15 — TypeORM — Requetes, Transactions & Migrations', link: '/modules/15-typeorm-requetes-migrations' },
            { text: '16 — Prisma — Schema, Client & Migrations', link: '/modules/16-prisma-schema-client' },
            { text: '17 — Prisma — Requetes avancees & Comparaison', link: '/modules/17-prisma-avance-comparaison' },
            { text: '18 — NestJS — Testing', link: '/modules/18-nestjs-testing' },
            { text: '19 — NestJS — Authentification & Autorisation', link: '/modules/19-nestjs-auth' },
            { text: '20 — NestJS — Configuration & Swagger', link: '/modules/20-nestjs-config-swagger' },
            { text: '21 — NestJS — WebSockets, Fichiers & Temps reel', link: '/modules/21-nestjs-websockets-fichiers' },
            { text: '22 — NestJS — Taches planifiees & Files d\'attente', link: '/modules/22-nestjs-jobs-queues' },
            { text: '23 — Performance & Deploiement', link: '/modules/23-performance-deploiement' },
            { text: '24 — Projet Final — API E-commerce complete', link: '/modules/24-projet-final' }
          ]
        }
      ],
      '/quizzes/': [
        {
          text: 'Quizzes',
          items: [
            { text: 'Tous les quizzes', link: '/quizzes/' },
            { text: 'Quiz 00 — Prerequis', link: '/quizzes/quiz-00-prerequis' },
            { text: 'Quiz 01 — Event Loop', link: '/quizzes/quiz-01-event-loop' },
            { text: 'Quiz 02 — Modules & FS', link: '/quizzes/quiz-02-modules-fs' },
            { text: 'Quiz 03 — Streams & Buffers', link: '/quizzes/quiz-03-streams' },
            { text: 'Quiz 04 — Serveur HTTP', link: '/quizzes/quiz-04-serveur-http' },
            { text: 'Quiz 05 — Express Fondamentaux', link: '/quizzes/quiz-05-express-fondamentaux' },
            { text: 'Quiz 06 — Middleware', link: '/quizzes/quiz-06-middleware' },
            { text: 'Quiz 07 — Validation & Erreurs', link: '/quizzes/quiz-07-validation-erreurs' },
            { text: 'Quiz 08 — Auth & Securite', link: '/quizzes/quiz-08-auth-securite' },
            { text: 'Quiz 09 — NestJS Introduction', link: '/quizzes/quiz-09-nestjs-introduction' },
            { text: 'Quiz 10 — Controllers', link: '/quizzes/quiz-10-controllers' },
            { text: 'Quiz 11 — Providers & DI', link: '/quizzes/quiz-11-providers-di' },
            { text: 'Quiz 12 — Modules', link: '/quizzes/quiz-12-modules' },
            { text: 'Quiz 13 — Pipes & Guards', link: '/quizzes/quiz-13-pipes-guards' },
            { text: 'Quiz 14 — TypeORM Entites', link: '/quizzes/quiz-14-typeorm-entites' },
            { text: 'Quiz 15 — TypeORM Requetes', link: '/quizzes/quiz-15-typeorm-requetes' },
            { text: 'Quiz 16 — Prisma Schema', link: '/quizzes/quiz-16-prisma-schema' },
            { text: 'Quiz 17 — Prisma Avance', link: '/quizzes/quiz-17-prisma-avance' },
            { text: 'Quiz 18 — Testing', link: '/quizzes/quiz-18-testing' },
            { text: 'Quiz 19 — Auth NestJS', link: '/quizzes/quiz-19-auth-nestjs' },
            { text: 'Quiz 20 — Config & Swagger', link: '/quizzes/quiz-20-config-swagger' },
            { text: 'Quiz 21 — WebSockets', link: '/quizzes/quiz-21-websockets' },
            { text: 'Quiz 22 — Queues', link: '/quizzes/quiz-22-queues' },
            { text: 'Quiz 23 — Performance', link: '/quizzes/quiz-23-performance' },
            { text: 'Quiz 24 — Projet Final', link: '/quizzes/quiz-24-projet-final' }
          ]
        }
      ],
      '/visualizations/': [
        {
          text: 'Visualisations',
          items: [
            { text: 'Toutes les visualisations', link: '/visualizations/' },
            { text: 'Event Loop', link: '/visualizations/event-loop' },
            { text: 'Middleware Pipeline', link: '/visualizations/middleware-pipeline' },
            { text: 'Dependency Injection', link: '/visualizations/dependency-injection' },
            { text: 'ORM Query Flow', link: '/visualizations/orm-query-flow' },
            { text: 'NestJS Lifecycle', link: '/visualizations/nestjs-lifecycle' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: 'Sur cette page'
    },

    docFooter: {
      prev: 'Précédent',
      next: 'Suivant'
    }
  }
})
