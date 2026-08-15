import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationModulesController } from "./organization-modules.controller";
import { ModuleRegistryService } from "./module-registry.service";
import { ModuleActivationService } from "./module-activation.service";
import { ModuleUninstallService } from "./module-uninstall.service";
import { ModuleActiveGuard } from "./guards/module-active.guard";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationModulesController],
  providers: [ModuleRegistryService, ModuleActivationService, ModuleUninstallService, ModuleActiveGuard],
  // ModuleActivationService/ModuleActiveGuard are exported so a future
  // module can gate its own routes with @RequireModule without duplicating
  // this machinery. ModuleUninstallService is exported for the same
  // reason, even though nothing calls it yet (see its own doc comment).
  exports: [ModuleRegistryService, ModuleActivationService, ModuleUninstallService, ModuleActiveGuard],
})
export class ModuleRegistryModule {}
