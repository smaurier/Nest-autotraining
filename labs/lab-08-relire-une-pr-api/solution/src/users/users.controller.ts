// users.controller.ts — LA PR (suite, dernier fichier). Ne pas oublier : le résultat de
// `updateProfile` est ce que le CLIENT reçoit tel quel, dans la réponse HTTP.
import { Body, Controller, Param, Patch } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(":id/profile")
  updateProfile(@Param("id") id: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(id, dto);
  }
}
