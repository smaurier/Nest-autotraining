# Lab 11 — Providers & Injection de dépendances

## Objectifs

- Comprendre le système d'injection de dépendances de NestJS
- Créer des providers personnalises (@Injectable)
- Utiliser un factory provider (useFactory)
- Injecter des services dans d'autres services
- Comprendre le pattern forRoot pour les modules dynamiques

## Description

Vous allez créer trois modules :
1. **LoggerModule** — un service de logging injectable
2. **ConfigModule** — un module dynamique avec forRoot et un factory provider
3. **GreetingModule** — un service qui depend de Logger et Config

## Instructions

1. Implementez `src/logger/logger.service.ts` :
   - Méthodes `log(message)`, `warn(message)`, `error(message)`
   - Chaque méthode doit prefixer le message avec le niveau de log

2. Implementez `src/config/config.service.ts` :
   - Utilise un factory provider pour recevoir la configuration
   - Méthode `get(key)` pour lire une valeur de config

3. Implementez `src/greeting/greeting.service.ts` :
   - Injectez LoggerService et ConfigService
   - Méthode `greet(name)` qui retourne un message de bienvenue
     utilisant la config 'greeting.prefix' (defaut: 'Hello')

4. Implementez `src/greeting/greeting.controller.ts` :
   - GET /greeting/:name -> retourne { message: 'Hello, name!' }

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/logger/logger.service.ts`
- `src/config/config.service.ts`
- `src/greeting/greeting.service.ts`
- `src/greeting/greeting.controller.ts`
