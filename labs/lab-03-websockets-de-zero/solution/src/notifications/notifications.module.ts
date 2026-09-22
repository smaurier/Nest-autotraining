// notifications.module.ts — SOLUTION DE RÉFÉRENCE. Ne l'ouvre pas avant ton GREEN.
import { Module } from "@nestjs/common";
import { NotificationsGateway } from "./notifications.gateway";

@Module({ providers: [NotificationsGateway] })
export class NotificationsModule {}
