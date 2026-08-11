import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AssistiveDevicesController } from "./assistive-devices.controller";
import { AssistiveDevicesService } from "./assistive-devices.service";

@Module({
  imports: [AuthModule],
  controllers: [AssistiveDevicesController],
  providers: [AssistiveDevicesService],
  exports: [AssistiveDevicesService],
})
export class AssistiveDevicesModule {}
