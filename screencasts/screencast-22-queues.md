# Screencast 22 — Queues & Taches

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/22-nestjs-jobs-queues.md`
- **Lab associe** : `labs/lab-22-queues/`
- **Prerequis** : Screencast 21 (WebSockets & Fichiers)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Redis installe et demarre (ou Docker avec Redis)
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Pourquoi les queues ?

> Salut ! Certaines operations sont trop longues ou trop lourdes pour etre executees dans le cycle requete-reponse : envoyer un email, generer un PDF, traiter une image, synchroniser des donnees. Les queues permettent de les executer en arriere-plan.

**Action** : Afficher le slide de titre "Module 22 — Queues & Taches".

> Le principe est simple : au lieu d'executer le travail immediatement, on le place dans une file d'attente. Un worker (processeur) le recupere et l'execute de maniere asynchrone. Le client recoit une reponse instantanee : "votre demande est en cours de traitement".

**Action** : Demarrer Redis (prerequis pour Bull).

```bash
# Avec Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Verifier que Redis fonctionne
docker exec -it redis redis-cli ping
```

### [03:00-08:00] Bull Queue — Files d'attente dans NestJS

**Action** : Installer les dependances.

```bash
npm install @nestjs/bull bull
npm install -D @types/bull
```

**Action** : Configurer Bull dans l'application.

```typescript
// src/app.module.ts
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    // ...autres modules
  ],
})
export class AppModule {}
```

**Action** : Creer un module de queue pour l'envoi d'emails.

```typescript
// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
```

```typescript
// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MailService {
  constructor(@InjectQueue('mail') private mailQueue: Queue) {}

  async sendWelcomeEmail(email: string, name: string) {
    const job = await this.mailQueue.add('welcome', {
      to: email,
      name,
      template: 'welcome',
    });
    return { jobId: job.id, status: 'queued' };
  }

  async sendPasswordReset(email: string, token: string) {
    const job = await this.mailQueue.add('password-reset', {
      to: email,
      token,
      template: 'password-reset',
    }, {
      priority: 1, // Haute priorite
    });
    return { jobId: job.id, status: 'queued' };
  }

  async getJobStatus(jobId: string) {
    const job = await this.mailQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { jobId, state, progress: job.progress(), data: job.data };
  }
}
```

### [08:00-13:00] Processor — Traiter les jobs

**Action** : Creer le processeur de la queue.

```typescript
// src/mail/mail.processor.ts
import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('mail')
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);

  @Process('welcome')
  async handleWelcomeEmail(job: Job<{ to: string; name: string }>) {
    this.logger.log(`Envoi email de bienvenue a ${job.data.to}`);

    // Simuler l'envoi (en production : nodemailer, SendGrid, etc.)
    await this.simulateEmailSending(job);

    this.logger.log(`Email de bienvenue envoye a ${job.data.to}`);
    return { sent: true, to: job.data.to };
  }

  @Process('password-reset')
  async handlePasswordReset(job: Job<{ to: string; token: string }>) {
    this.logger.log(`Envoi email de reset a ${job.data.to}`);
    await this.simulateEmailSending(job);
    this.logger.log(`Email de reset envoye a ${job.data.to}`);
    return { sent: true, to: job.data.to };
  }

  private async simulateEmailSending(job: Job) {
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await job.progress((i / steps) * 100);
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) demarre`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} (${job.name}) termine: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) echoue: ${error.message}`);
  }
}
```

**Action** : Creer un controller pour tester.

```typescript
// src/mail/mail.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private mailService: MailService) {}

  @Post('welcome')
  sendWelcome(@Body() body: { email: string; name: string }) {
    return this.mailService.sendWelcomeEmail(body.email, body.name);
  }

  @Get('status/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.mailService.getJobStatus(jobId);
  }
}
```

**Action** : Tester les queues.

```bash
# Ajouter un job
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","name":"Alice"}' \
  http://localhost:3000/mail/welcome

# Verifier le statut
curl http://localhost:3000/mail/status/1
```

> Regardez les logs du serveur : le job est traite en arriere-plan avec la progression qui s'affiche. Le client a recu sa reponse immediatement avec le jobId. Il peut verifier le statut quand il veut.

### [13:00-16:00] Cron Jobs — Taches planifiees

**Action** : Installer le module de scheduling.

```bash
npm install @nestjs/schedule
```

```typescript
// src/app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

**Action** : Creer des taches planifiees.

```typescript
// src/tasks/tasks.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval, Timeout } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(private tasksService: TasksService) {}

  // Tous les jours a minuit
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldTasks() {
    this.logger.log('Nettoyage des anciennes taches...');
    // Supprimer les taches terminees de plus de 30 jours
    const result = await this.tasksService.cleanupOld(30);
    this.logger.log(`${result} taches supprimees`);
  }

  // Toutes les 5 minutes
  @Cron('*/5 * * * *')
  async checkOverdueTasks() {
    this.logger.log('Verification des taches en retard...');
  }

  // Toutes les 30 secondes
  @Interval(30000)
  handleHealthCheck() {
    this.logger.debug('Health check OK');
  }

  // 10 secondes apres le demarrage
  @Timeout(10000)
  handleStartup() {
    this.logger.log('Application initialisee, demarrage des taches planifiees');
  }
}
```

> `@Cron` accepte des expressions cron standard. `@Interval` execute a intervalle regulier. `@Timeout` execute une seule fois apres un delai.

### [16:00-18:30] Retry et monitoring

> Les jobs peuvent echouer. La configuration `attempts: 3` avec `backoff: exponential` reessaie automatiquement avec un delai croissant.

**Action** : Montrer le comportement de retry dans les logs.

> Le premier essai echoue, Bull attend 1 seconde. Le deuxieme essai echoue, il attend 2 secondes. Le troisieme essai reussit. C'est le backoff exponentiel. Pour le monitoring en production, vous pouvez ajouter Bull Board — une interface web pour surveiller les queues.

### [18:30-19:30] Recap

> Les queues Bull permettent de traiter les taches lourdes en arriere-plan avec retry automatique. Les Cron jobs planifient des taches recurrentes. Ensemble, ils couvrent tous les besoins de traitement asynchrone.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-22-queues/`. Vous allez creer une queue avec processeur, des cron jobs, et gerer les erreurs avec retry. Au prochain screencast, performance et deploiement !

## Points d'attention pour l'enregistrement
- S'assurer que Redis tourne avant de demarrer l'application
- Montrer les logs en temps reel pour voir les jobs se traiter
- La progression du job (0%, 20%, 40%...) doit etre visible dans les logs
- Expliquer le backoff exponentiel avec un exemple concret
