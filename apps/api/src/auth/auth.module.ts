import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AppConfig } from "../config/configuration";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { jwtAccessSecret, jwtAccessTtl } = configService.getOrThrow<AppConfig>("app");
        return { secret: jwtAccessSecret, signOptions: { expiresIn: jwtAccessTtl } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
