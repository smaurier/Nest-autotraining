# Module 22 — NestJS — Taches planifiees & Files d'attente

> **Objectif** : Implementer des taches planifiees (cron jobs) avec @nestjs/schedule et des files d'attente (queues) avec Bull/BullMQ pour traiter des operations longues de manière asynchrone.
> **Difficulte** : ⭐⭐⭐⭐ (avance+)
> **Prérequis** : Module 11 (Services), Module 12 (Modules), Redis installe
> **Duree estimee** : 5 heures

---

## 1. Introduction — Pourquoi les taches asynchrones ?

### 1.1 Le problème

Certaines operations sont trop longues pour etre executees dans le cycle requête-réponse HTTP :

- Envoi d'emails (1-5 secondes)
- Génération de rapports PDF (10-30 secondes)
- Redimensionnement d'images (2-10 secondes)
- Import de fichiers CSV (minutes)
- Nettoyage de donnees (variable)

Si vous executez ces operations directement dans un endpoint, l'utilisateur attend... et attend... et risque un timeout.

> **Analogie** : Imaginez un restaurant. Le serveur (votre API) prend la commande et la transmet à la cuisine (la queue). Il ne reste pas plante devant le four a attendre que le plat soit pret. Il revient a sa table (réponse HTTP) et la cuisine le previent quand c'est fini (événement).

### 1.2 Deux approches complementaires

| Approche | Utilite | Exemple |
|----------|---------|---------|
| **Taches planifiees** (Cron) | Exécuter une tache a intervalle regulier | Nettoyage quotidien, rapport hebdomadaire |
| **Files d'attente** (Queue) | Traiter une tache quand elle arrive | Envoi d'email, génération PDF |

---

## 2. Taches planifiees avec @nestjs/schedule

### 2.1 Installation

```bash
npm install @nestjs/schedule
```

### 2.2 Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Active le systeme de planification
    TasksModule,
  ],
})
export class AppModule {}
```

### 2.3 Le decorateur @Cron

```typescript
// tasks/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval, Timeout } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger('TasksService');

  // === @Cron — Expression cron ===

  // Chaque jour a minuit
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup() {
    this.logger.log('Nettoyage quotidien des sessions expirees');
    // Logique de nettoyage...
  }

  // Chaque lundi a 8h00
  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyReport() {
    this.logger.log('Generation du rapport hebdomadaire');
    // Logique de rapport...
  }

  // Expression cron personnalisee : chaque jour a 2h30 du matin
  @Cron('30 2 * * *')
  async handleDatabaseBackup() {
    this.logger.log('Sauvegarde de la base de donnees');
    // Logique de backup...
  }

  // Toutes les 5 minutes (du lundi au vendredi)
  @Cron('*/5 * * * 1-5')
  async handleHealthCheck() {
    this.logger.log('Verification de sante des services externes');
    // Logique de health check...
  }

  // Le premier jour de chaque mois a 6h00
  @Cron('0 6 1 * *')
  async handleMonthlyInvoice() {
    this.logger.log('Generation des factures mensuelles');
    // Logique de facturation...
  }
}
```

### 2.4 Syntaxe des expressions cron

```
┌───────── seconde (optionnel, 0-59)
│ ┌─────── minute (0-59)
│ │ ┌───── heure (0-23)
│ │ │ ┌─── jour du mois (1-31)
│ │ │ │ ┌── mois (1-12)
│ │ │ │ │ ┌ jour de la semaine (0-7, 0 et 7 = dimanche)
│ │ │ │ │ │
* * * * * *
```

| Expression | Description |
|-----------|-------------|
| `* * * * *` | Chaque minute |
| `*/5 * * * *` | Toutes les 5 minutes |
| `0 * * * *` | Chaque heure (à la minute 0) |
| `0 0 * * *` | Chaque jour a minuit |
| `0 8 * * 1-5` | Du lundi au vendredi a 8h00 |
| `0 0 1 * *` | Le 1er de chaque mois a minuit |
| `0 6,18 * * *` | A 6h et 18h chaque jour |
| `30 2 * * *` | Chaque jour a 2h30 |

### 2.5 CronExpression — Constantes predefinies

```typescript
import { CronExpression } from '@nestjs/schedule';

CronExpression.EVERY_SECOND           // * * * * * *
CronExpression.EVERY_5_SECONDS        // */5 * * * * *
CronExpression.EVERY_10_SECONDS       // */10 * * * * *
CronExpression.EVERY_30_SECONDS       // */30 * * * * *
CronExpression.EVERY_MINUTE           // */1 * * * *
CronExpression.EVERY_5_MINUTES        // 0 */5 * * * *
CronExpression.EVERY_10_MINUTES       // 0 */10 * * * *
CronExpression.EVERY_30_MINUTES       // 0 */30 * * * *
CronExpression.EVERY_HOUR             // 0 0 * * * *
CronExpression.EVERY_DAY_AT_MIDNIGHT  // 0 0 0 * * *
CronExpression.EVERY_DAY_AT_1AM      // 0 0 1 * * *
CronExpression.EVERY_WEEK             // 0 0 0 * * 0
CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT // 0 0 0 1 * *
CronExpression.EVERY_QUARTER          // 0 0 0 1 */3 *
```

### 2.6 @Interval et @Timeout

```typescript
@Injectable()
export class TasksService {
  // Executer toutes les 30 secondes (en millisecondes)
  @Interval(30000)
  handleInterval() {
    this.logger.log('Tache executee toutes les 30 secondes');
  }

  // Nommer l'intervalle pour pouvoir l'arreter
  @Interval('metricsCollection', 60000)
  handleMetrics() {
    this.logger.log('Collecte des metriques');
  }

  // Executer UNE SEULE FOIS apres un delai (en millisecondes)
  @Timeout(5000)
  handleTimeout() {
    this.logger.log('Execute une seule fois, 5 secondes apres le demarrage');
  }

  // Timeout nomme
  @Timeout('warmup', 10000)
  handleWarmup() {
    this.logger.log('Prechauffage du cache au demarrage');
  }
}
```

### 2.7 Controle dynamique des taches

```typescript
import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class TasksService {
  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  // Ajouter un cron job dynamiquement
  addCronJob(name: string, cronExpression: string) {
    const job = new CronJob(cronExpression, () => {
      this.logger.log(`Tache dynamique "${name}" executee`);
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  // Arreter un cron job
  stopCronJob(name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.stop();
    this.logger.log(`Tache "${name}" arretee`);
  }

  // Supprimer un cron job
  deleteCronJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
  }

  // Lister tous les cron jobs
  listCronJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    const jobList: string[] = [];
    jobs.forEach((value, key) => {
      const nextDate = value.nextDate();
      jobList.push(`${key} → prochaine execution : ${nextDate}`);
    });
    return jobList;
  }

  // Arreter un intervalle
  stopInterval(name: string) {
    const interval = this.schedulerRegistry.getInterval(name);
    clearInterval(interval);
    this.schedulerRegistry.deleteInterval(name);
  }
}
```

---

## 3. Files d'attente avec Bull / BullMQ

### 3.1 Qu'est-ce que Bull ?

**Bull** (et sa version modernisee **BullMQ**) est une bibliotheque de files d'attente robuste pour Node.js, basee sur Redis.

> **Analogie** : Une file d'attente c'est comme la file à la poste. Chaque client (job) arrive avec sa demandé, prend un ticket, et attend son tour. Les guichetiers (workers) traitent les demandes dans l'ordre. Si un guichetier tombe malade (crash), le client est remis dans la file.

### 3.2 Installation

```bash
# Option 1 : Bull (stable, largement utilise)
npm install @nestjs/bull bull
npm install --save-dev @types/bull

# Option 2 : BullMQ (version moderne, recommandee pour les nouveaux projets)
npm install @nestjs/bullmq bullmq
```

Prérequis : **Redis** doit etre installe et accessible.

```bash
# Installation locale de Redis
# macOS : brew install redis
# Linux : sudo apt install redis-server
# Windows : utiliser Docker
docker run -d --name redis -p 6379:6379 redis
```

### 3.3 Configuration avec @nestjs/bull

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    // Configuration globale de Bull (connexion Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', undefined),
        },
        defaultJobOptions: {
          attempts: 3,           // 3 tentatives en cas d'echec
          backoff: {
            type: 'exponential', // Delai exponentiel entre les tentatives
            delay: 1000,         // 1s, 2s, 4s, 8s...
          },
          removeOnComplete: 100, // Garder les 100 derniers jobs completes
          removeOnFail: 200,     // Garder les 200 derniers jobs echoues
        },
      }),
    }),
    EmailModule,
  ],
})
export class AppModule {}
```

### 3.4 Définir une Queue

```typescript
// email/email.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    // Enregistrer la queue 'email'
    BullModule.registerQueue({
      name: 'email',
      // Options specifiques a cette queue
      limiter: {
        max: 10,       // Maximum 10 jobs traites
        duration: 1000, // par seconde (rate limiting)
      },
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
```

### 3.5 Le Producer — Ajouter des jobs à la queue

```typescript
// email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Types des donnees de job
interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

interface SendBulkEmailJobData {
  recipients: string[];
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  constructor(
    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {}

  // Ajouter un job d'envoi d'email
  async sendEmail(data: SendEmailJobData) {
    const job = await this.emailQueue.add('send', data, {
      // Options specifiques a ce job
      priority: 1,        // Priorite (1 = plus haute)
      attempts: 5,         // 5 tentatives
      backoff: {
        type: 'exponential',
        delay: 2000,       // 2s, 4s, 8s, 16s, 32s
      },
    });

    this.logger.log(`Job d'email ajoute : #${job.id} vers ${data.to}`);
    return { jobId: job.id };
  }

  // Envoi differe (dans 30 minutes)
  async sendEmailLater(data: SendEmailJobData, delayMs: number) {
    const job = await this.emailQueue.add('send', data, {
      delay: delayMs,  // Delai en millisecondes
    });

    this.logger.log(
      `Email programme dans ${delayMs / 1000}s : #${job.id}`,
    );
    return { jobId: job.id };
  }

  // Envoi en masse
  async sendBulkEmail(data: SendBulkEmailJobData) {
    const job = await this.emailQueue.add('sendBulk', data, {
      attempts: 3,
      timeout: 60000, // Timeout de 60 secondes pour les envois en masse
    });

    this.logger.log(
      `Job d'email en masse ajoute : #${job.id} (${data.recipients.length} destinataires)`,
    );
    return { jobId: job.id };
  }

  // Email de bienvenue (apres inscription)
  async sendWelcomeEmail(email: string, nom: string) {
    return this.sendEmail({
      to: email,
      subject: 'Bienvenue sur notre plateforme !',
      template: 'welcome',
      context: { nom, loginUrl: 'https://example.com/login' },
    });
  }

  // Email de reset de mot de passe
  async sendPasswordResetEmail(email: string, token: string) {
    return this.sendEmail({
      to: email,
      subject: 'Reinitialisation de votre mot de passe',
      template: 'password-reset',
      context: {
        resetUrl: `https://example.com/reset?token=${token}`,
        expiration: '1 heure',
      },
    });
  }

  // Verifier le statut d'un job
  async getJobStatus(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    return {
      id: job.id,
      status: state,
      progress: job.progress(),
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
    };
  }

  // Statistiques de la queue
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
```

### 3.6 Le Consumer (Processor) — Traiter les jobs

```typescript
// email/email.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  OnQueueStalled,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('email') // Le nom doit correspondre a la queue
export class EmailProcessor {
  private readonly logger = new Logger('EmailProcessor');

  // Traiter les jobs de type 'send'
  @Process('send')
  async handleSendEmail(job: Job<{ to: string; subject: string; template: string; context: any }>) {
    this.logger.log(`Traitement du job #${job.id} : envoi a ${job.data.to}`);

    try {
      // Mise a jour de la progression
      await job.progress(10);

      // Simuler l'envoi d'email (remplacer par un vrai service mail)
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail({...});
      await this.simulateEmailSend(job.data);

      await job.progress(100);

      this.logger.log(`Email envoye avec succes a ${job.data.to}`);

      // La valeur retournee est stockee comme resultat du job
      return {
        success: true,
        sentAt: new Date().toISOString(),
        to: job.data.to,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi a ${job.data.to} : ${error.message}`,
      );
      // Relancer l'erreur pour que Bull retente
      throw error;
    }
  }

  // Traiter les jobs de type 'sendBulk'
  @Process('sendBulk')
  async handleSendBulkEmail(job: Job<{ recipients: string[]; subject: string; template: string; context: any }>) {
    const { recipients } = job.data;
    this.logger.log(
      `Envoi en masse : ${recipients.length} destinataires (Job #${job.id})`,
    );

    let sent = 0;
    for (const recipient of recipients) {
      try {
        await this.simulateEmailSend({
          to: recipient,
          subject: job.data.subject,
          template: job.data.template,
          context: job.data.context,
        });
        sent++;
        // Mise a jour de la progression
        await job.progress(Math.round((sent / recipients.length) * 100));
      } catch (error) {
        this.logger.warn(`Echec pour ${recipient} : ${error.message}`);
      }
    }

    return { sent, total: recipients.length };
  }

  // === Evenements de la queue ===

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Job #${job.id} demarre (type: ${job.name})`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `Job #${job.id} termine avec succes — Resultat : ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job #${job.id} echoue (tentative ${job.attemptsMade}/${job.opts.attempts}) : ${error.message}`,
    );
  }

  @OnQueueStalled()
  onStalled(job: Job) {
    this.logger.warn(`Job #${job.id} bloque (stalled) — sera retente`);
  }

  // Simulation d'envoi (a remplacer par un vrai service)
  private async simulateEmailSend(data: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    // 5% de chance d'echec pour tester les retries
    if (Math.random() < 0.05) {
      throw new Error('Erreur SMTP simulee');
    }
  }
}
```

### 3.7 Concurrence des workers

```typescript
// Traiter jusqu'a 5 jobs en parallele
@Process({ name: 'send', concurrency: 5 })
async handleSendEmail(job: Job) {
  // ...
}

// Ou au niveau de la configuration du processor
@Processor({
  name: 'email',
  concurrency: 3,  // 3 jobs max en parallele pour toute la queue
})
export class EmailProcessor {}
```

---

## 4. Cycle de vie d'un Job

```
                     ┌─────────┐
                     │ WAITING │ ← Job ajoute a la queue
                     └────┬────┘
                          │
                          v
              ┌───────────────────────┐
              │       DELAYED          │ ← Si option delay configuree
              └───────────┬───────────┘
                          │ (apres le delai)
                          v
                     ┌─────────┐
                     │ ACTIVE  │ ← Un worker prend le job
                     └────┬────┘
                          │
                ┌─────────┴──────────┐
                v                    v
         ┌────────────┐      ┌────────────┐
         │ COMPLETED  │      │   FAILED   │
         └────────────┘      └─────┬──────┘
                                   │
                          (si attempts restants)
                                   │
                                   v
                             ┌──────────┐
                             │ WAITING  │ ← Remis dans la queue
                             └──────────┘
```

---

## 5. Patterns avances

### 5.1 Retry avec backoff exponentiel

```typescript
// Le job sera retente avec des delais croissants
const job = await this.emailQueue.add('send', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000, // Delais : 1s, 2s, 4s, 8s, 16s
  },
});

// Ou backoff fixe
const job = await this.emailQueue.add('send', data, {
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 5000, // Toujours 5 secondes entre les tentatives
  },
});
```

### 5.2 Dead Letter Queue (DLQ)

Quand un job echoue definitivement (toutes les tentatives epuisees), on peut le deplacer vers une queue speciale pour analyse.

```typescript
@OnQueueFailed()
async onFailed(job: Job, error: Error) {
  // Si c'est la derniere tentative
  if (job.attemptsMade >= (job.opts.attempts || 1)) {
    this.logger.error(`Job #${job.id} definitivement echoue — Ajout a la DLQ`);

    // Ajouter a la dead letter queue
    await this.deadLetterQueue.add('failed-email', {
      originalJobId: job.id,
      originalData: job.data,
      error: error.message,
      attempts: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
  }
}
```

#### Reperes operationnels utiles

En pratique, l'objectif n'est pas d'avoir 0 echec, mais de **maitriser** les echecs.

| Indicateur | Cible de depart | Seuil d'alerte |
|---|---|---|
| Taux de jobs en echec (15 min) | < 1% | > 5% |
| Taille DLQ | proche de 0 | > 100 messages |
| Age du plus vieux job en attente | < 60 s | > 300 s |
| Temps moyen de traitement d'un job | stable (baseline) | x2 vs baseline |

Ces seuils donnent une base de pilotage. Ils doivent etre ajustes selon le volume reel de votre application.

### 5.3 Bull Board — Interface de monitoring

```bash
npm install @bull-board/express @bull-board/api
```

```typescript
// main.ts
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Recuperer les queues
  const emailQueue = app.get<Queue>('BullQueue_email');
  const reportQueue = app.get<Queue>('BullQueue_report');

  // Configurer Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullAdapter(emailQueue),
      new BullAdapter(reportQueue),
    ],
    serverAdapter,
  });

  // Monter l'interface
  app.use('/admin/queues', serverAdapter.getRouter());

  await app.listen(3000);
  console.log('Bull Board : http://localhost:3000/admin/queues');
}
```

---

## 6. Exemple complet — Génération de rapports

```typescript
// reports/reports.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportsService } from './reports.service';
import { ReportsProcessor } from './reports.processor';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'report',
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
})
export class ReportsModule {}
```

```typescript
// reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ReportsService {
  constructor(
    @InjectQueue('report')
    private readonly reportQueue: Queue,
  ) {}

  async generateReport(type: 'ventes' | 'utilisateurs' | 'produits', params: any) {
    const job = await this.reportQueue.add('generate', {
      type,
      params,
      requestedAt: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      message: `Generation du rapport "${type}" en cours...`,
      statusUrl: `/reports/status/${job.id}`,
    };
  }

  async getStatus(jobId: string) {
    const job = await this.reportQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      status: state,
      progress: job.progress(),
      result: state === 'completed' ? job.returnvalue : undefined,
      error: state === 'failed' ? job.failedReason : undefined,
    };
  }
}
```

```typescript
// reports/reports.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('report')
export class ReportsProcessor {
  private readonly logger = new Logger('ReportsProcessor');

  @Process('generate')
  async handleGenerate(job: Job) {
    const { type, params } = job.data;
    this.logger.log(`Generation du rapport "${type}" (Job #${job.id})`);

    await job.progress(10);

    // Simulation de la generation (remplacer par la vraie logique)
    let data: any;
    switch (type) {
      case 'ventes':
        data = await this.generateSalesReport(params);
        break;
      case 'utilisateurs':
        data = await this.generateUsersReport(params);
        break;
      case 'produits':
        data = await this.generateProductsReport(params);
        break;
    }

    await job.progress(90);

    // Sauvegarder le fichier PDF/Excel
    const filePath = `/reports/${type}-${job.id}.pdf`;
    // await this.pdfService.generate(data, filePath);

    await job.progress(100);

    return {
      type,
      filePath,
      generatedAt: new Date().toISOString(),
      rowCount: data?.length || 0,
    };
  }

  private async generateSalesReport(params: any) {
    await new Promise((r) => setTimeout(r, 5000));
    return [{ mois: 'Janvier', total: 15000 }];
  }

  private async generateUsersReport(params: any) {
    await new Promise((r) => setTimeout(r, 3000));
    return [{ total: 150, actifs: 120 }];
  }

  private async generateProductsReport(params: any) {
    await new Promise((r) => setTimeout(r, 4000));
    return [{ categorie: 'Tech', count: 45 }];
  }
}
```

```typescript
// reports/reports.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  generate(@Body() body: { type: string; params: any }) {
    return this.reportsService.generateReport(body.type as any, body.params);
  }

  @Get('status/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.reportsService.getStatus(jobId);
  }
}
```

---

## 7. Exercices pratiques

### Exercice 1 : Taches planifiees

Implementez :
1. Un nettoyage quotidien des tokens de refresh expires
2. Un rapport hebdomadaire par email du nombre de nouveaux utilisateurs
3. Une vérification toutes les 5 minutes de la connectivite à la base de donnees

### Exercice 2 : Queue d'emails

Implementez un système complet d'envoi d'emails avec :
1. Queue pour les emails individuels
2. Queue pour les emails en masse
3. Retry avec backoff exponentiel
4. Monitoring avec Bull Board
5. Dead letter queue pour les echecs definitifs

### Exercice 3 : Traitement d'images

Creez une queue de traitement d'images qui :
1. Recoit une image uploadee
2. Genere 3 tailles (thumbnail 100x100, medium 400x400, large 800x800)
3. Met a jour la base de donnees avec les chemins des images
4. Rapporte la progression du traitement

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 22 | `quiz/22-quiz.md` |
| Lab Module 22 | `labs/22-lab-jobs-queues.md` |
| Screencast | `screencasts/22-screencast.md` |
| Module précédent | [Module 21 — WebSockets & Fichiers](21-nestjs-websockets-fichiers.md) |
| Module suivant | [Module 23 — Performance & Déploiement](23-performance-deploiement.md) |
| @nestjs/schedule | https://docs.nestjs.com/techniques/task-scheduling |
| @nestjs/bull | https://docs.nestjs.com/techniques/queues |
| Bull Documentation | https://optimalbits.github.io/bull/ |
| BullMQ Documentation | https://docs.bullmq.io/ |
| Bull Board | https://github.com/felixmosh/bull-board |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 22 queues](../screencasts/screencast-22-queues.md)
2. **Lab** : [lab-22-queues](../labs/lab-22-queues/README)
3. **Quiz** : [quiz 22 queues](../quizzes/quiz-22-queues.html)
:::
