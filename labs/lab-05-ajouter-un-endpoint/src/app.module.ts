// app.module.ts — DONNÉ. Ne se modifie pas.
import { Module } from "@nestjs/common";
import { PostsModule } from "./posts/posts.module";

@Module({ imports: [PostsModule] })
export class AppModule {}
