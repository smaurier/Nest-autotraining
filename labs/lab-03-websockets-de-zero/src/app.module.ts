// app.module.ts — DONNÉ. Assemble le module que tu écris. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({ imports: [NotificationsModule] })
export class AppModule {}
