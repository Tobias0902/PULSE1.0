import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { combinedSchema } from "./module-schemas";
import { AppConfig } from "../config/configuration";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");
export const DATABASE_CLIENT = Symbol("DATABASE_CLIENT");

export type Database = PostgresJsDatabase<typeof combinedSchema>;

// The type of the `tx` handle drizzle passes into a db.transaction(...)
// callback — same query-building surface as Database, minus .transaction
// itself. Services that need transactional writes (see AuditService,
// EventBusService) accept either.
export type Transaction = Parameters<Database["transaction"]>[0] extends (tx: infer T) => unknown ? T : never;
export type DbClient = Database | Transaction;

// The raw postgres.js client is provided separately from the drizzle
// instance so DatabaseModule can close it on shutdown (see
// database.module.ts) without every consumer needing to know it exists.
export const databaseClientProvider: Provider = {
  provide: DATABASE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const { databaseUrl } = configService.getOrThrow<AppConfig>("app");
    return postgres(databaseUrl);
  },
};

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,
  inject: [DATABASE_CLIENT],
  useFactory: (client: postgres.Sql): Database => drizzle(client, { schema: combinedSchema }),
};
