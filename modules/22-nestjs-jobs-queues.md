---
titre: NestJS jobs et queues
cours: 09-nestjs
notions: [traitement en arrière-plan, files d'attente avec BullMQ et Redis, producteur et processor, options de job retries et backoff, tâches planifiées avec le module schedule, décorateur Cron, workers, monitoring des jobs]
outcomes: [mettre un travail lourd en file avec BullMQ, écrire un processor, configurer retries et backoff, planifier une tâche récurrente avec Cron]
prerequis: [21-nestjs-websockets-fichiers]
next: 23-nestjs-performance-deploiement
libs: [{ name: "@nestjs/bullmq", version: "^11" }, { name: bullmq, version: "^5" }, { name: "@nestjs/schedule", version: "^6" }]
tribuzen: jobs TribuZen (envoi async des emails d'invitation, génération de la gazette hebdomadaire)
last-reviewed: 2026-07
---

# NestJS jobs et queues

> **Outcomes — tu sauras FAIRE :** mettre un travail lourd en file d'attente BullMQ, écrire un processor avec `WorkerHost`, configurer retries et backoff exponentiel, planifier une tâche récurrente avec le décorateur `@Cron`.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

TribuZen doit envoyer un email d'invitation dès qu'un membre en ajoute un autre à sa famille. Première tentative dans le controller :

```ts
// ❌ naïf — email synchrone dans le handler HTTP
@Post('invite')
async invite(@Body() dto: InviteDto) {
  await this.mailer.sendInviteMail(dto.email)   // 2-5 secondes bloquantes
  return { ok: true }                            // l'utilisateur attend tout ce temps
}
```

Problème réel : l'envoi SMTP prend 2-5 s. Sur mobile 3G, l'utilisateur voit un loader, puis un timeout. Si le serveur mail est temporairement down, la requête échoue avec 500 — l'invitation est perdue définitivement.

Le même problème se répète chaque lundi matin : TribuZen doit générer la gazette hebdomadaire (agrège les événements de la semaine, formate un email, l'envoie à toutes les familles). Ce travail ne vit pas dans un endpoint — personne ne l'appelle manuellement.

Deux solutions complémentaires dans NestJS :

| Besoin | Outil | Cas TribuZen |
|--------|-------|--------------|
| Travail déclenché par une action utilisateur | BullMQ — file d'attente Redis | Envoi d'email d'invitation |
| Travail déclenché par l'horloge | `@nestjs/schedule` — décorateur `@Cron` | Gazette hebdomadaire |

Ce module couvre les deux : BullMQ (producteur, processor `WorkerHost`, retries) et `@nestjs/schedule` (`@Cron`, `@Interval`).

## 2. Théorie complète, concise

### 2.1 BullMQ — architecture

BullMQ est une file d'attente persistée dans Redis. Trois acteurs :

| Acteur | Rôle | Classe NestJS |
|--------|------|---------------|
| Queue | Reçoit et stocke les jobs | injectée via `@InjectQueue()` |
| Worker (Processor) | Dépile et traite les jobs | `WorkerHost` + `@Processor()` |
| Redis | Persistance — jobs survivent au redémarrage | externe, lancé via Docker |

Cycle de vie d'un job :

```
add() → WAITING → ACTIVE → COMPLETED
                         ↘ FAILED → (WAITING si attempts restants)
```

Si le worker crash pendant `ACTIVE`, BullMQ replace le job en `WAITING` — aucune perte.

### 2.2 Installation et configuration

```bash
pnpm add @nestjs/bullmq bullmq
```

Configurer la connexion Redis une seule fois dans `AppModule` :

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { InvitationModule } from './invitation/invitation.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
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
    InvitationModule,
  ],
})
export class AppModule {}
```

`forRootAsync` — même pattern que `TypeOrmModule.forRootAsync` : factory + `inject` pour recevoir `ConfigService`. La connexion Redis est partagée par toutes les queues de l'application.

### 2.3 Enregistrer une queue

```ts
// invitation.module.ts
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { InvitationService } from './invitation.service'
import { InvitationProcessor } from './invitation.processor'

@Module({
  imports: [
    // Déclare la queue et crée le token @InjectQueue('invitation')
    BullModule.registerQueue({ name: 'invitation' }),
  ],
  providers: [InvitationService, InvitationProcessor],
  exports: [InvitationService],
})
export class InvitationModule {}
```

`registerQueue` déclare la queue nommée et crée le token d'injection `@InjectQueue('invitation')`. Sans cette ligne dans `imports`, NestJS lève `Nest can't resolve dependencies of InvitationService (?)` — le `forRootAsync` dans `AppModule` configure Redis globalement mais ne crée pas les queues individuelles.

### 2.4 Producteur — ajouter un job

```ts
// invitation.service.ts
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'               // Queue importée depuis bullmq, pas @nestjs/bullmq

@Injectable()
export class InvitationService {
  constructor(
    // Token généré par registerQueue({ name: 'invitation' })
    @InjectQueue('invitation') private readonly invitationQueue: Queue,
  ) {}

  async enqueueInvite(familyId: string, email: string): Promise<{ jobId: string }> {
    const job = await this.invitationQueue.add(
      'send-invite',              // nom du job — routé dans le switch du processor
      { familyId, email },        // payload sérialisé dans Redis
      {
        attempts: 3,              // 3 tentatives avant FAILED définitif
        backoff: {
          type: 'exponential',    // 1 s, 2 s, 4 s entre les tentatives
          delay: 1000,
        },
        removeOnComplete: { count: 100 }, // garder les 100 derniers jobs complétés
        removeOnFail: { count: 200 },
      },
    )
    return { jobId: String(job.id) }
  }
}
```

Le handler HTTP retourne `{ jobId }` en quelques millisecondes — l'utilisateur n'attend plus l'envoi SMTP.

### 2.5 Processor — traiter les jobs avec WorkerHost

L'API de `@nestjs/bullmq` utilise `WorkerHost` (classe de base) + `@Processor()` (décorateur de classe). Le `@Process()` de l'ancien package `@nestjs/bull` n'existe pas dans `@nestjs/bullmq` — c'est une source fréquente de confusion.

```ts
// invitation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

@Processor('invitation')   // doit correspondre exactement au name passé à registerQueue
export class InvitationProcessor extends WorkerHost {
  private readonly logger = new Logger(InvitationProcessor.name)

  // NestJS appelle process() pour chaque job dépilé de la queue
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'send-invite': {
        const { familyId, email } = job.data as { familyId: string; email: string }
        this.logger.log(`[job #${job.id}] invitation → ${email} (famille ${familyId})`)
        await job.updateProgress(50)
        await this.dispatchInviteEmail(email, familyId)
        await job.updateProgress(100)
        return
      }
      default:
        this.logger.warn(`[job #${job.id}] type de job inconnu : ${job.name}`)
    }
  }

  private async dispatchInviteEmail(email: string, familyId: string): Promise<void> {
    // Appel réel : MailerService, Resend, SendGrid…
    this.logger.log(`[SMTP] invitation envoyée à ${email} pour famille ${familyId}`)
  }
}
```

`WorkerHost` gère la connexion Redis et l'écoute de la queue. Tu n'instancies jamais `Worker` manuellement — NestJS le fait au démarrage du module, dès que `InvitationProcessor` est dans `providers`.

### 2.6 Options de job — retries et backoff

| Option | Type | Effet |
|--------|------|-------|
| `attempts` | `number` | Nombre total de tentatives (1 = pas de retry) |
| `backoff.type` | `'exponential'` / `'fixed'` | Stratégie de délai entre tentatives |
| `backoff.delay` | `number` (ms) | Délai de base — exponentiel : ×2 à chaque tentative |
| `delay` | `number` (ms) | Délai avant la première exécution (job différé) |
| `removeOnComplete` | `{ count: N }` | Nettoyer les anciens jobs complétés |
| `removeOnFail` | `{ count: N }` | Garder N jobs échoués pour audit |

```ts
// backoff exponentiel — tentatives à +1 s, +2 s, +4 s
{ attempts: 3, backoff: { type: 'exponential', delay: 1000 } }

// backoff fixe — toujours 5 s entre les tentatives
{ attempts: 5, backoff: { type: 'fixed', delay: 5000 } }

// job différé de 30 minutes (bienvenue envoyée après l'inscription)
{ delay: 30 * 60 * 1000 }
```

Quand `process()` lève une erreur, BullMQ re-planifie automatiquement le job selon `backoff`. Après épuisement de `attempts`, le job passe en `FAILED` et reste dans Redis pour inspection ou rejoue manuelle.

### 2.7 Tâches planifiées avec @nestjs/schedule

```bash
pnpm add @nestjs/schedule
```

```ts
// app.module.ts — activer le planificateur global une seule fois
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

`ScheduleModule.forRoot()` démarre le planificateur global. Tous les services `@Injectable()` qui utilisent `@Cron`, `@Interval` ou `@Timeout` dans des modules importés sont automatiquement découverts.

### 2.8 Décorateur @Cron

```ts
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression, Interval } from '@nestjs/schedule'

@Injectable()
export class GazetteScheduler {
  private readonly logger = new Logger(GazetteScheduler.name)

  // Chaque lundi à 8h00 — gazette hebdomadaire TribuZen
  @Cron('0 8 * * 1')
  async handleWeeklyGazette(): Promise<void> {
    this.logger.log('Génération de la gazette hebdomadaire')
    // appel à GazetteService.generateAndSend()
  }

  // Constante prédéfinie — chaque jour à minuit
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('Nettoyage des tokens expirés')
  }

  // Toutes les 5 minutes — health check
  @Interval(5 * 60 * 1000)
  handleHealthCheck(): void {
    this.logger.debug('Health check planificateur : OK')
  }
}
```

Syntaxe cron (5 champs : minute heure jour-mois mois jour-semaine) :

| Expression | Déclenchement |
|------------|---------------|
| `'0 8 * * 1'` | Lundi à 8h00 |
| `'0 0 * * *'` | Chaque jour à minuit |
| `'*/5 * * * *'` | Toutes les 5 minutes |
| `'0 6,18 * * *'` | À 6h et 18h chaque jour |
| `CronExpression.EVERY_WEEK` | Dimanche à minuit |
| `CronExpression.EVERY_DAY_AT_MIDNIGHT` | Chaque jour à minuit |

## 3. Worked examples

### Exemple A — InvitationModule complet (producteur + processor + module)

```ts
// src/invitation/invitation.module.ts
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { InvitationService } from './invitation.service'
import { InvitationProcessor } from './invitation.processor'
import { InvitationController } from './invitation.controller'

@Module({
  imports: [
    // Enregistre la queue 'invitation' et crée le token @InjectQueue('invitation')
    BullModule.registerQueue({ name: 'invitation' }),
  ],
  controllers: [InvitationController],
  providers: [InvitationService, InvitationProcessor],
})
export class InvitationModule {}
```

```ts
// src/invitation/invitation.jobs.ts
// Constantes partagées entre producteur et processor — évite les typos
export const INVITE_JOB = 'send-invite' as const
export const WELCOME_JOB = 'welcome' as const
```

```ts
// src/invitation/invitation.service.ts
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { INVITE_JOB, WELCOME_JOB } from './invitation.jobs'

export interface InviteJobData {
  familyId: string
  email: string
  invitedBy: string
}

@Injectable()
export class InvitationService {
  constructor(
    @InjectQueue('invitation') private readonly invitationQueue: Queue,
  ) {}

  async enqueueInvite(data: InviteJobData): Promise<{ jobId: string }> {
    const job = await this.invitationQueue.add(INVITE_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    })
    return { jobId: String(job.id) }
  }

  async enqueueWelcome(email: string): Promise<{ jobId: string }> {
    // job différé — email de bienvenue envoyé 10 minutes après l'inscription
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

@Processor('invitation')
export class InvitationProcessor extends WorkerHost {
  private readonly logger = new Logger(InvitationProcessor.name)

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case INVITE_JOB: {
        const { familyId, email, invitedBy } = job.data as InviteJobData
        this.logger.log(`[job #${job.id}] invitation → ${email} (famille ${familyId}, par ${invitedBy})`)
        await job.updateProgress(30)
        await this.dispatchInviteEmail(email, familyId)
        await job.updateProgress(100)
        return
      }
      case WELCOME_JOB: {
        const { email } = job.data as { email: string }
        this.logger.log(`[job #${job.id}] email de bienvenue → ${email}`)
        await this.dispatchWelcomeEmail(email)
        return
      }
      default:
        this.logger.warn(`[job #${job.id}] type de job inconnu : ${job.name}`)
    }
  }

  private async dispatchInviteEmail(email: string, familyId: string): Promise<void> {
    // Appel réel : MailerService, Resend, SendGrid…
    this.logger.log(`[SMTP] invitation envoyée à ${email} pour famille ${familyId}`)
  }

  private async dispatchWelcomeEmail(email: string): Promise<void> {
    this.logger.log(`[SMTP] email de bienvenue envoyé à ${email}`)
  }
}
```

```ts
// src/invitation/invitation.controller.ts
import { Controller, Post, Body } from '@nestjs/common'
import { InvitationService } from './invitation.service'

@Controller('invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  async invite(@Body() dto: { familyId: string; email: string; invitedBy: string }) {
    // Retourne immédiatement — l'envoi SMTP se fait en arrière-plan
    return this.invitationService.enqueueInvite(dto)
  }
}
```

**Pas-à-pas :** (1) `BullModule.registerQueue({ name: 'invitation' })` dans `imports` crée le token — sans lui, `@InjectQueue('invitation')` lève `No provider` ; (2) `Queue` est importée depuis `bullmq` (pas `@nestjs/bullmq`) — le package NestJS fournit les décorateurs, le package `bullmq` fournit les types ; (3) `INVITE_JOB` et `WELCOME_JOB` sont des constantes partagées — une typo côté producteur ou processor causerait un job jamais traité, sans erreur visible ; (4) `InvitationProcessor extends WorkerHost` + `@Processor('invitation')` — NestJS crée le `Worker` BullMQ sous le capot au démarrage du module ; (5) `updateProgress(n)` permet de suivre l'avancement d'un job depuis l'extérieur (Bull Board, API de statut).

### Exemple B — GazetteModule avec @Cron et @Interval

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

@Injectable()
export class GazetteScheduler {
  private readonly logger = new Logger(GazetteScheduler.name)

  constructor(private readonly gazetteService: GazetteService) {}

  // Chaque lundi à 8h00 — gazette hebdomadaire TribuZen
  @Cron('0 8 * * 1')
  async handleWeeklyGazette(): Promise<void> {
    this.logger.log('Lancement génération gazette hebdomadaire')
    try {
      const count = await this.gazetteService.generateAndSend()
      this.logger.log(`Gazette envoyée à ${count} familles`)
    } catch (err) {
      // @Cron ne retry pas automatiquement — try/catch obligatoire
      this.logger.error(`Échec gazette : ${(err as Error).message}`)
    }
  }

  // Chaque nuit à minuit — purge des tokens expirés
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('Nettoyage quotidien des tokens expirés')
    await this.gazetteService.purgeExpiredTokens()
  }

  // Toutes les 5 minutes — monitoring health Redis/BullMQ
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
    // for (const family of families) { await this.mailer.sendGazette(family) }
    return 42 // simulation — nombre de familles notifiées
  }

  async purgeExpiredTokens(): Promise<void> {
    this.logger.log("Purge des tokens d'invitation expirés")
    // await this.tokenRepo.deleteExpired()
  }
}
```

**Pas-à-pas :** (1) `ScheduleModule.forRoot()` dans `AppModule` est la condition sine qua non — sans lui, `@Cron` et `@Interval` sont silencieusement ignorés ; (2) `@Cron('0 8 * * 1')` = lundi à 8h00, syntaxe 5 champs (minute heure jour-mois mois jour-semaine) ; (3) `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` utilise la constante prédéfinie — plus lisible qu'une string brute ; (4) `@Interval(5 * 60 * 1000)` déclenche toutes les 5 minutes sans drift (pas un `setTimeout` récursif) ; (5) le try/catch dans `handleWeeklyGazette` est obligatoire — `@Cron` ne gère pas les erreurs automatiquement, une exception non capturée passe silencieusement.

## 4. Pièges & misconceptions

- **`@Process()` n'existe pas dans `@nestjs/bullmq`.** Le décorateur `@Process('send-invite')` appartient à l'ancien package `@nestjs/bull`. Dans `@nestjs/bullmq`, le bon pattern est `WorkerHost` + `process(job)` + switch sur `job.name`. Importer `@Process` depuis `@nestjs/bullmq` échoue à la compilation. Si tu migres d'un projet `@nestjs/bull`, tout le processor est à réécrire.

- **Oublier `registerQueue` dans le module consommateur.** `@InjectQueue('invitation')` dans `InvitationService` suppose que `BullModule.registerQueue({ name: 'invitation' })` est dans `imports` du même module (ou d'un module importé). Sans lui, NestJS lève `Nest can't resolve dependencies`. Le `forRootAsync` dans `AppModule` configure Redis globalement mais ne crée pas les tokens de queue.

- **Processor absent de `providers`.** `@Processor('invitation')` est un décorateur, pas une déclaration implicite. Si `InvitationProcessor` n'est pas dans `providers: [InvitationProcessor]` du module, NestJS ne l'instancie pas — la queue se remplit dans Redis mais aucun worker ne consomme. Les jobs restent bloqués en `WAITING` indéfiniment.

- **Noms de job divergents.** `queue.add('send-invite', ...)` côté producteur et `case 'send-invite':` dans le processor doivent être strictement identiques. Une typo (`'sendInvite'` vs `'send-invite'`) entraîne un job qui tombe dans `default:` sans traitement visible — aucune erreur, aucun log d'alerte. Solution : constantes partagées `export const INVITE_JOB = 'send-invite'` importées des deux côtés.

- **`@Cron` sans `@Injectable()`.** Un scheduler sans `@Injectable()` ne peut pas être géré par le conteneur IoC. NestJS ne découvre pas ses méthodes `@Cron`. Symptôme : l'app démarre sans erreur, mais aucune tâche ne se déclenche jamais. Même piège si le service n'est pas dans `providers` du module.

- **`ScheduleModule.forRoot()` absent d'`AppModule`.** Sans lui, tous les `@Cron` et `@Interval` de l'application sont silencieusement ignorés — aucune erreur au démarrage, aucune tâche ne s'exécute. C'est le piège le plus difficile à diagnostiquer car rien dans les logs ne signale le problème.

- **`@Cron` n'est pas fault-tolerant.** Si l'application est down au moment du déclenchement prévu (redémarrage, déploiement), le job est perdu. Pour une gazette envoyée à 8h00 pendant un déploiement à 7h58, elle ne sera jamais envoyée ce jour-là. Pour les tâches critiques, utiliser BullMQ avec `repeat: { pattern: '0 8 * * 1' }` — le job est persisté dans Redis et peut être rattrapé.

## 5. Ancrage TribuZen

Couche fil-rouge : **jobs TribuZen (envoi async des emails d'invitation, génération de la gazette hebdomadaire)** (`smaurier/tribuzen`).

- `InvitationService.enqueueInvite()` retourne `{ jobId }` en quelques millisecondes. L'utilisateur n'attend plus l'envoi SMTP. Le job est persisté dans Redis — si l'API redémarre entre le `POST /invitation` et le traitement, le job est conservé et retraité automatiquement au redémarrage.
- `InvitationProcessor` gère deux types via switch : `'send-invite'` (3 retries expo) et `'welcome'` (différé 10 min). Un seul processor par queue — cohérence et traçabilité centralisées.
- `GazetteScheduler` planifie `'0 8 * * 1'` (lundi 8h00) et la purge quotidienne à minuit. Il injecte `GazetteService` par DI — le scheduler orchestre, le service concentre la logique métier.
- `backoff: { type: 'exponential', delay: 1000 }` protège le serveur mail externe : si Resend est momentanément surchargé, les retries ne pilonnent pas (1 s, 2 s, 4 s). L'API TribuZen reste disponible pendant ce temps.
- `removeOnComplete: { count: 100 }` + `removeOnFail: { count: 200 }` évitent l'accumulation illimitée dans Redis — les 200 derniers jobs échoués restent accessibles pour audit sans saturer la mémoire.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  invitation/
    invitation.module.ts      ← BullModule.registerQueue + providers
    invitation.service.ts     ← producteur — enqueueInvite(), enqueueWelcome()
    invitation.processor.ts   ← WorkerHost — process() avec switch(job.name)
    invitation.controller.ts  ← POST /invitation
    invitation.jobs.ts        ← INVITE_JOB, WELCOME_JOB (constantes partagées)
  gazette/
    gazette.module.ts
    gazette.scheduler.ts      ← @Cron lundi 8h + @Cron minuit + @Interval 5 min
    gazette.service.ts        ← generateAndSend(), purgeExpiredTokens()
```

## 6. Points clés

1. BullMQ persiste les jobs dans Redis — ils survivent au redémarrage de l'API, contrairement à un `setTimeout` ou `setInterval` en mémoire.
2. `BullModule.forRootAsync()` dans `AppModule` = connexion Redis globale ; `BullModule.registerQueue()` dans le module consommateur = déclaration d'une queue individuelle.
3. Producteur : `@InjectQueue('nom') private queue: Queue` (`Queue` depuis `bullmq`) + `queue.add('job-name', data, options)`.
4. Processor `@nestjs/bullmq` : `@Processor('nom') export class X extends WorkerHost` + `async process(job: Job)` — le `@Process()` de l'ancien `@nestjs/bull` n'existe pas dans cette version.
5. Switch sur `job.name` dans `process()` pour router plusieurs types de jobs dans un même processor — extraire les noms dans des constantes partagées pour éviter les divergences.
6. `attempts` + `backoff: { type: 'exponential', delay }` = protection automatique contre les pannes transitoires ; relancer l'erreur dans `process()` déclenche le retry BullMQ.
7. `ScheduleModule.forRoot()` dans `AppModule` est obligatoire pour activer `@Cron` et `@Interval` — sans lui, aucun déclenchement, aucune erreur visible.
8. `@Cron` perd les déclenchements si l'app est down ; BullMQ avec `repeat` les persiste dans Redis — choisir selon la criticité de la tâche.

## 7. Seeds Anki

```
Quelle classe doit étendre un processor dans @nestjs/bullmq ?|WorkerHost — @Processor('nom') export class X extends WorkerHost { async process(job: Job) { ... } }
Comment router plusieurs types de jobs dans un même processor @nestjs/bullmq ?|Switch sur job.name dans process() — case 'send-invite' / case 'welcome' — sans décorateur supplémentaire
Différence BullModule.forRootAsync vs BullModule.registerQueue ?|forRootAsync = connexion Redis globale (une fois dans AppModule) ; registerQueue = déclare une queue nommée dans le module consommateur
Que se passe-t-il si process() lève une erreur dans BullMQ ?|BullMQ marque le job FAILED et le re-planifie selon backoff/attempts — si attempts épuisées le job reste FAILED dans Redis pour audit
Pourquoi backoff exponential plutôt que fixed pour un envoi email ?|Exponentiel laisse croître les délais (1s, 2s, 4s) — si le serveur SMTP est surchargé on ne le pilonne pas ; fixed enverrait au même rythme
Que fait ScheduleModule.forRoot() et où le placer ?|Active le planificateur global de @nestjs/schedule — doit être dans AppModule, sans lui @Cron et @Interval sont silencieusement ignorés
@Cron vs BullMQ repeat — quand choisir quoi ?|@Cron = simple, perte si app down au déclenchement ; BullMQ repeat = persisté dans Redis, tolère les redémarrages — préférer BullMQ pour les tâches critiques
Comment éviter la divergence entre queue.add('send-invite') et le switch du processor ?|Extraire dans une constante partagée — export const INVITE_JOB = 'send-invite' — importée par InvitationService ET InvitationProcessor
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-22-queues/README.md`. Tu y implémentes `InvitationModule` avec BullMQ (producteur + processor + retries) et `GazetteScheduler` avec `@Cron` — corrigé complet commenté + variante J+30 dans le README.

← [Module 21 — NestJS WebSockets et fichiers](21-nestjs-websockets-fichiers.md) | [Module 23 — NestJS performance et déploiement](23-nestjs-performance-deploiement.md) →
