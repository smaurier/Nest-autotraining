# Lab 22 — NestJS jobs et queues

> **Outcome :** à la fin, tu sais mettre un job en file avec BullMQ (`@nestjs/bullmq`), écrire un processor `WorkerHost`, configurer retries et backoff, et planifier une tâche récurrente avec `@Cron` dans NestJS 11.
> **Vrai outil :** NestJS 11, `@nestjs/bullmq ^11`, `bullmq ^5`, `@nestjs/schedule ^6`, Redis (Docker).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis deux modules TribuZen dans un projet NestJS 11 existant — pas de gap-fill, tu écris tout de A à Z à partir d'un projet vierge (`nest new tribuzen-queues`).

Objectif fonctionnel :

- `POST /invitation` → enqueue un job `'send-invite'` dans BullMQ et retourne `{ jobId }` immédiatement
- Un processor `WorkerHost` traite `'send-invite'` et `'welcome'` via switch sur `job.name`
- Les jobs `'send-invite'` sont configurés avec 3 tentatives et backoff exponentiel (1 s, 2 s, 4 s)
- Un `GazetteScheduler` déclenche la gazette chaque lundi à 8h00 (`@Cron`) et un health check toutes les 5 minutes (`@Interval`)
- Redis tourne en local via Docker (`docker run -d -p 6379:6379 redis`)

## Étapes (en friction)

1. Installer les dépendances et démarrer Redis :

   ```bash
   pnpm add @nestjs/bullmq bullmq @nestjs/schedule
   docker run -d --name redis -p 6379:6379 redis
   ```

2. Dans `AppModule`, configurer `BullModule.forRootAsync()` avec `ConfigService` (host `localhost`, port `6379`). Ajouter `ScheduleModule.forRoot()`. Importer `InvitationModule` et `GazetteModule`.

3. Créer `src/invitation/invitation.jobs.ts` avec les constantes `INVITE_JOB = 'send-invite'` et `WELCOME_JOB = 'welcome'`. Ce fichier sera importé par le service ET le processor.

4. Créer `InvitationModule` (`src/invitation/invitation.module.ts`) :
   - `imports: [BullModule.registerQueue({ name: 'invitation' })]`
   - `providers: [InvitationService, InvitationProcessor]`
   - `controllers: [InvitationController]`

5. Créer `InvitationService` (`src/invitation/invitation.service.ts`) :
   - Injecter `@InjectQueue('invitation') private queue: Queue` (`Queue` depuis `bullmq`)
   - Implémenter `enqueueInvite(data)` avec `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`, `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 200 }`
   - Implémenter `enqueueWelcome(email)` avec `delay: 10 * 60 * 1000`

6. Créer `InvitationProcessor` (`src/invitation/invitation.processor.ts`) :
   - `@Processor('invitation') export class InvitationProcessor extends WorkerHost`
   - Implémenter `async process(job: Job): Promise<void>` avec switch sur `job.name`
   - Gérer `INVITE_JOB` (log + `updateProgress`) et `WELCOME_JOB` (log)
   - Cas `default:` — log warn pour les jobs inconnus

7. Créer `InvitationController` (`src/invitation/invitation.controller.ts`) :
   - `POST /invitation` → appelle `invitationService.enqueueInvite(dto)` et retourne le `{ jobId }`

8. Créer `GazetteModule` avec `GazetteScheduler` et `GazetteService` :
   - `@Cron('0 8 * * 1')` → appelle `gazetteService.generateAndSend()` dans un try/catch
   - `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` → appelle `gazetteService.purgeExpiredTokens()`
   - `@Interval(5 * 60 * 1000)` → log debug health check

9. Vérifier : `pnpm start:dev`, puis `curl -X POST http://localhost:3000/invitation -H "Content-Type: application/json" -d '{"familyId":"fam-1","email":"bob@tribu.fr","invitedBy":"alice"}'` → réponse `{ "jobId": "..." }` immédiate. Observer les logs du processor.

## Corrigé complet commenté

```ts
// src/invitation/invitation.jobs.ts
// Constantes partagées entre producteur et processor — évite les divergences de noms
export const INVITE_JOB = 'send-invite' as const
export const WELCOME_JOB = 'welcome' as const
```

```ts
// src/invitation/invitation.module.ts
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { InvitationService } from './invitation.service'
import { InvitationProcessor } from './invitation.processor'
import { InvitationController } from './invitation.controller'

@Module({
  imports: [
    // registerQueue crée le token @InjectQueue('invitation')
    // Sans cette ligne : "Nest can't resolve dependencies of InvitationService"
    BullModule.registerQueue({ name: 'invitation' }),
  ],
  controllers: [InvitationController],
  providers: [
    InvitationService,
    InvitationProcessor, // obligatoire — sans lui la queue se remplit mais personne ne consomme
  ],
})
export class InvitationModule {}
```

```ts
// src/invitation/invitation.service.ts
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'              // Queue depuis bullmq (pas @nestjs/bullmq)
import { INVITE_JOB, WELCOME_JOB } from './invitation.jobs'

export interface InviteJobData {
  familyId: string
  email: string
  invitedBy: string
}

@Injectable()
export class InvitationService {
  constructor(
    // @InjectQueue() obligatoire — le token vient de BullModule.registerQueue
    @InjectQueue('invitation') private readonly invitationQueue: Queue,
  ) {}

  async enqueueInvite(data: InviteJobData): Promise<{ jobId: string }> {
    const job = await this.invitationQueue.add(INVITE_JOB, data, {
      attempts: 3,                                  // 3 tentatives totales
      backoff: { type: 'exponential', delay: 1000 }, // +1s, +2s, +4s entre tentatives
      removeOnComplete: { count: 100 },             // garder les 100 derniers complétés
      removeOnFail: { count: 200 },                 // garder les 200 derniers échoués pour audit
    })
    return { jobId: String(job.id) }
  }

  async enqueueWelcome(email: string): Promise<{ jobId: string }> {
    // delay : envoyé 10 minutes après l'inscription, pas immédiatement
    const job = await this.invitationQueue.add(
      WELCOME_JOB,
      { email },
      { delay: 10 * 60 * 1000, attempts: 2 },
    )
    return { jobId: String(job.id) }
  }
}
```

```ts
// src/invitation/invitation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { INVITE_JOB, WELCOME_JOB } from './invitation.jobs'
import type { InviteJobData } from './invitation.service'

// @Processor('invitation') — nom identique à registerQueue({ name: 'invitation' })
@Processor('invitation')
export class InvitationProcessor extends WorkerHost {
  private readonly logger = new Logger(InvitationProcessor.name)

  // NestJS appelle process() pour chaque job dépilé
  // Lever une erreur ici = BullMQ déclenche le retry selon backoff/attempts
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case INVITE_JOB: {
        const { familyId, email, invitedBy } = job.data as InviteJobData
        this.logger.log(`[job #${job.id}] invitation → ${email} (famille ${familyId}, par ${invitedBy})`)
        await job.updateProgress(30)
        // Simuler l'envoi — remplacer par MailerService réel
        await new Promise(r => setTimeout(r, 200))
        await job.updateProgress(100)
        return
      }
      case WELCOME_JOB: {
        const { email } = job.data as { email: string }
        this.logger.log(`[job #${job.id}] email de bienvenue → ${email}`)
        await new Promise(r => setTimeout(r, 100))
        return
      }
      default:
        // Log warn — ne pas lever d'erreur pour un job inconnu (évite les retries inutiles)
        this.logger.warn(`[job #${job.id}] type de job inconnu : ${job.name}`)
    }
  }
}
```

```ts
// src/invitation/invitation.controller.ts
import { Controller, Post, Body } from '@nestjs/common'
import { InvitationService } from './invitation.service'
import type { InviteJobData } from './invitation.service'

@Controller('invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  async invite(@Body() dto: InviteJobData) {
    // Retourne en quelques ms — l'envoi SMTP se fait en arrière-plan
    return this.invitationService.enqueueInvite(dto)
  }
}
```

```ts
// src/gazette/gazette.module.ts
import { Module } from '@nestjs/common'
import { GazetteScheduler } from './gazette.scheduler'
import { GazetteService } from './gazette.service'

@Module({
  providers: [GazetteScheduler, GazetteService],
})
export class GazetteModule {}
```

```ts
// src/gazette/gazette.scheduler.ts
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression, Interval } from '@nestjs/schedule'
import { GazetteService } from './gazette.service'

@Injectable() // obligatoire — sans @Injectable(), @Cron n'est jamais découvert
export class GazetteScheduler {
  private readonly logger = new Logger(GazetteScheduler.name)

  constructor(private readonly gazetteService: GazetteService) {}

  // Lundi à 8h00 — gazette hebdomadaire TribuZen
  // '0 8 * * 1' = minute=0, heure=8, jour-mois=*, mois=*, jour-semaine=1(lundi)
  @Cron('0 8 * * 1')
  async handleWeeklyGazette(): Promise<void> {
    this.logger.log('Lancement génération gazette hebdomadaire')
    try {
      const count = await this.gazetteService.generateAndSend()
      this.logger.log(`Gazette envoyée à ${count} familles`)
    } catch (err) {
      // @Cron ne retry pas — try/catch obligatoire pour éviter crash silencieux
      this.logger.error(`Échec gazette : ${(err as Error).message}`)
    }
  }

  // Chaque nuit à minuit — purge des tokens expirés
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('Nettoyage quotidien des tokens expirés')
    await this.gazetteService.purgeExpiredTokens()
  }

  // Toutes les 5 minutes — health check planificateur
  @Interval(5 * 60 * 1000)
  handleHealthCheck(): void {
    this.logger.debug('Health check planificateur : OK')
  }
}
```

```ts
// src/gazette/gazette.service.ts
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class GazetteService {
  private readonly logger = new Logger(GazetteService.name)

  async generateAndSend(): Promise<number> {
    this.logger.log('Agrégation des événements familles de la semaine')
    // const families = await this.familyRepo.findAllActive()
    // for (const f of families) { await this.mailer.sendGazette(f) }
    return 42 // simulation
  }

  async purgeExpiredTokens(): Promise<void> {
    this.logger.log("Purge des tokens d'invitation expirés")
    // await this.tokenRepo.deleteExpired()
  }
}
```

```ts
// src/app.module.ts (extrait)
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { InvitationModule } from './invitation/invitation.module'
import { GazetteModule } from './gazette/gazette.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
    // forRootAsync = connexion Redis globale, partagée par toutes les queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    // ScheduleModule.forRoot() = active @Cron et @Interval dans toute l'app
    ScheduleModule.forRoot(),
    InvitationModule,
    GazetteModule,
  ],
})
export class AppModule {}
```

## Variante J+30 (fading)

Même exercice sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter un troisième type de job `'bulk-invite'` dans `InvitationProcessor` : payload `{ emails: string[], familyId: string }`, loguer la progression (`updateProgress`) à chaque email traité dans une boucle.

2. Implémenter `getJobStatus(jobId: string)` dans `InvitationService` : récupérer le job depuis la queue avec `queue.getJob(jobId)`, retourner `{ state, progress, failedReason }`. Ajouter `GET /invitation/:jobId/status` dans le controller.

3. Rendre le cron gazette configurable : lire l'expression cron depuis `ConfigService` (`GAZETTE_CRON`) via `SchedulerRegistry`. Si la variable est absente, utiliser `'0 8 * * 1'` par défaut. Observer comment `SchedulerRegistry` permet de gérer les jobs dynamiquement.

Temps cible : 45 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(invitation): envoi async email + gazette hebdomadaire via BullMQ et @Cron
```

Fichiers à créer :

- `apps/api/src/invitation/invitation.module.ts`
- `apps/api/src/invitation/invitation.service.ts`
- `apps/api/src/invitation/invitation.processor.ts`
- `apps/api/src/invitation/invitation.controller.ts`
- `apps/api/src/invitation/invitation.jobs.ts`
- `apps/api/src/gazette/gazette.module.ts`
- `apps/api/src/gazette/gazette.scheduler.ts`
- `apps/api/src/gazette/gazette.service.ts`

Critère de done : `POST /invitation` répond `{ jobId: "..." }` en < 50 ms, le log du processor apparaît dans la console quelques ms plus tard. Les logs `@Cron` sont visibles au démarrage (next run affiché par NestJS).
