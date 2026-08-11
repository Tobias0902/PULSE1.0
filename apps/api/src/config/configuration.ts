export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtlDays: number;
}

export default (): { app: AppConfig } => ({
  app: {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: requireEnv("DATABASE_URL"),
    jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    jwtRefreshTtlDays: parseTtlDays(process.env.JWT_REFRESH_TTL ?? "30d"),
  },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseTtlDays(value: string): number {
  const match = /^(\d+)d$/.exec(value);
  return match ? Number(match[1]) : 30;
}
