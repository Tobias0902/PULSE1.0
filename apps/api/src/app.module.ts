import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import configuration from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { LocationsModule } from "./locations/locations.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { CustomersModule } from "./customers/customers.module";
import { AssistiveDevicesModule } from "./assistive-devices/assistive-devices.module";
import { CasesModule } from "./cases/cases.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { ModuleRegistryModule } from "./module-registry/module-registry.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Package scripts always run with apps/api as cwd (pnpm --filter / turbo),
      // so the single root .env is always two levels up from here.
      envFilePath: resolve(process.cwd(), "../../.env"),
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    LocationsModule,
    UsersModule,
    RolesModule,
    CustomersModule,
    AssistiveDevicesModule,
    CasesModule,
    AppointmentsModule,
    ModuleRegistryModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
