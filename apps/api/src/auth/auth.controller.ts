import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LoginResponse } from "@pulse/domain";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto } from "./dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginDto): Promise<LoginResponse> {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user.id, user.organizationId);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() body: RefreshDto): Promise<LoginResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() body: RefreshDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
