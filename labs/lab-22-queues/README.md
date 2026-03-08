# Lab 22 — Queues

## Objectifs

- Utiliser Bull (BullMQ) avec NestJS pour gerer des queues de taches
- Implementer un systeme d'envoi d'emails en arriere-plan
- Configurer les tentatives (retry) et le backoff
- Utiliser @nestjs/schedule pour les taches planifiees (cron, interval)

## Description

Vous allez creer un systeme de queue pour l'envoi d'emails avec :
- Un processeur qui traite les jobs d'email
- Un service qui ajoute des jobs a la queue
- Un controller HTTP pour declencher l'envoi
- Des taches planifiees pour le nettoyage et le monitoring

**Note**: Ce lab necessite Redis pour fonctionner en production. Les tests utilisent des mocks.

## Endpoints

| Methode | Route        | Description                |
|---------|-------------|----------------------------|
| POST    | /email/send | Ajouter un email a la queue |

## Instructions

1. **EmailProcessor** (`src/email/email.processor.ts`)
   - Decorez la classe avec @Processor('email')
   - Implementez un handler @Process() pour traiter les jobs
   - Implementez @Process('welcome') pour les emails de bienvenue
   - Implementez @OnQueueFailed pour gerer les erreurs

2. **EmailService** (`src/email/email.service.ts`)
   - Injectez la queue Bull avec @InjectQueue('email')
   - Implementez sendEmail(data) qui ajoute un job a la queue
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
