// app.module.ts — DONNÉ. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";

@Module({ imports: [UsersModule] })
export class AppModule {}
