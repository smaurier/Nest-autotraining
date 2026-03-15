# Lab 22 — Queues

## Objectifs

- Utiliser Bull (BullMQ) avec NestJS pour gérer des queues de taches
- Implementer un système d'envoi d'emails en arriere-plan
- Configurer les tentatives (retry) et le backoff
- Utiliser @nestjs/schedule pour les taches planifiees (cron, interval)

## Description

Vous allez créer un système de queue pour l'envoi d'emails avec :
- Un processeur qui traite les jobs d'email
- Un service qui ajoute des jobs à la queue
- Un controller HTTP pour declencher l'envoi
- Des taches planifiees pour le nettoyage et le monitoring

**Note**: Ce lab nécessité Redis pour fonctionner en production. Les tests utilisent des mocks.

## Endpoints

| Méthode | Route        | Description                |
|---------|-------------|----------------------------|
| POST    | /email/send | Ajouter un email à la queue |

## Instructions

1. **EmailProcessor** (`src/email/email.processor.ts`)
   - Decorez la classe avec @Processor('email')
   - Implementez un handler @Process() pour traiter les jobs
   - Implementez @Process('welcome') pour les emails de bienvenue
   - Implementez @OnQueueFailed pour gérer les erreurs

2. **EmailService** (`src/email/email.service.ts`)
   - Injectez la queue Bull avec @InjectQueue('email')
   - Implementez sendEmail(data) qui ajoute un job à la queue
   - Configurez les options: attempts, backoff, removeOnComplete

3. **EmailController** (`src/email/email.controller.ts`)
   - Implementez POST /email/send

4. **TasksService** (`src/tasks/tasks.service.ts`)
   - Implementez un @Cron pour le nettoyage quotidien
   - Implementez un @Interval pour le health check

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/email/email.processor.ts`
- `src/email/email.service.ts`
- `src/email/email.controller.ts`
- `src/tasks/tasks.service.ts`
