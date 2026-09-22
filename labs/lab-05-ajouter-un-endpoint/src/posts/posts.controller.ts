// posts.controller.ts — L'EXISTANT, EN PRODUCTION, que tu modifies pour ajouter une route.
// Les deux routes ci-dessous tournent déjà en prod : ne change ni leur forme ni leur
// comportement (le test de non-régression le vérifie).
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
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

  // TODO (ta tâche) : ajoute `GET /posts/:id`, qui délègue à `postsService.getById(id)`.
  // 200 avec le post si trouvé (NotFoundException du service → 404 automatique, Nest s'en
  // charge), rien d'autre à écrire pour ce cas.
}
