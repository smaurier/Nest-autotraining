// posts.controller.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  list(@Query("familyId") familyId: string) {
    return this.postsService.listByFamily(familyId);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  // Route ajoutée : GET /posts/:id AVANT toute route qui pourrait la capter par erreur —
  // ici sans ambiguïté puisque c'est la seule route GET avec paramètre du controller.
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.postsService.getById(id);
  }
}
