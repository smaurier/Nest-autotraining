// posts.controller.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Param } from "@nestjs/common";
import { PostsService } from "./posts.service";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.postsService.getById(id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @Headers("x-user-id") userId: string) {
    const post = this.postsService.getById(id); // lève NotFoundException si absent
    // Le contrôle d'accès AU NIVEAU DE L'OBJET (pas juste "es-tu connecté") : c'est exactement
    // la catégorie OWASP API Security #1, Broken Object Level Authorization. Une authentification
    // valide ne prouve JAMAIS un droit sur UNE ressource précise — il faut le vérifier explicitement.
    if (post.authorId !== userId) {
      throw new ForbiddenException("Tu ne peux supprimer que tes propres posts");
    }
    this.postsService.remove(id);
  }
}
