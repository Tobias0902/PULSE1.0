import { Global, Inject, Module, OnModuleDestroy } from "@nestjs/common";
import postgres from "postgres";
import { DATABASE_CLIENT, databaseClientProvider, databaseProvider } from "./database.provider";

@Global()
@Module({
  providers: [databaseClientProvider, databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: postgres.Sql) {}

  // Closes the connection pool on app shutdown (including NestJS test
  // apps' app.close()). Without this, every process that boots AppModule —
  // notably e2e tests — hangs on exit with an open TCP handle.
  async onModuleDestroy() {
    await this.client.end();
  }
}
