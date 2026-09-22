// posts.controller.ts — L'EXISTANT, EN PRODUCTION. Un ticket de sécurité vient d'arriver
// (voir README). Modifie CE fichier pour le corriger — c'est le seul à toucher.
//
// Simplification assumée pour ce lab (voir README § Note d'adaptation) : l'authentification
// est déjà faite en amont (par un vrai JwtAuthGuard comme au lab 02, qu'on ne rejoue pas ici) ;
// l'en-tête `x-user-id` porte l'identité VÉRIFIÉE de l'appelant — traite-le comme une donnée
// de confiance, ce n'est PAS le sujet de ce lab.
import { Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param } from "@nestjs/common";
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
    // Le post existe ? Vérifié. L'appelant est authentifié ? Vérifié (en amont).
    // Manque une question : CET appelant a-t-il le DROIT de supprimer CE post précis ?
    this.postsService.getById(id); // lève NotFoundException si absent — inchangé, garde ça
    this.postsService.remove(id);
  }
}
