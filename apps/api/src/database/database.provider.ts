import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { AppConfig } from "../config/configuration";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

export type Database = PostgresJsDatabase<typeof schema>;

export const databaseProvider: Provider = {
  provide: DATABASE_CONNECTION,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Database => {
    const { databaseUrl } = configService.getOrThrow<AppConfig>("app");
    const client = postgres(databaseUrl);
    return drizzle(client, { schema });
  },
};
