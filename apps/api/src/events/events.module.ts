import { Global, Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EventBusService } from "./event-bus.service";
import { EventDispatcherService } from "./event-dispatcher.service";

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [EventBusService, EventDispatcherService],
  exports: [EventBusService],
})
export class EventsModule {}
