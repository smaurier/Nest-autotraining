// families.controller.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { FamiliesService } from "./families.service";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { ApiKeyGuard } from "./api-key.guard";

@Controller("families")
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateFamilyDto) {
    return this.familiesService.createFamily(dto.name);
  }

  @Post(":id/members")
  @HttpCode(201)
  @UseGuards(ApiKeyGuard)
  addMember(@Param("id") id: string, @Body() dto: AddMemberDto) {
    return this.familiesService.addMember(id, dto);
  }

  @Get(":id/members")
  listMembers(@Param("id") id: string) {
    return this.familiesService.listMembers(id);
  }
}
