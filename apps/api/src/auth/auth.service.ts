import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { eq, and, isNull } from "drizzle-orm";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { LoginResponse } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { refreshTokens, users } from "../database/schema";
import { resolveUserPermissions } from "./permissions.helper";
import { AppConfig } from "../config/configuration";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return user;
  }

  async login(userId: string, organizationId: string): Promise<LoginResponse> {
    const permissions = await resolveUserPermissions(this.db, userId);
    const { jwtAccessTtl, jwtRefreshTtlDays } = this.configService.getOrThrow<AppConfig>("app");

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, organizationId, permissions },
      { expiresIn: jwtAccessTtl },
    );

    const { rawToken, tokenHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + jwtRefreshTtlDays * 24 * 60 * 60 * 1000);
    await this.db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });

    return {
      accessToken,
      refreshToken: rawToken,
      expiresAt: expiresAt.toISOString(),
      organizationId,
    };
  }

  async refresh(rawToken: string): Promise<LoginResponse> {
    const tokenHash = hashToken(rawToken);
    const record = await this.db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)),
    });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, record.userId) });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    // Rotate: revoke the used refresh token, issue a fresh pair.
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));

    return this.login(user.id, user.organizationId);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }
}

function generateRefreshToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(48).toString("base64url");
  return { rawToken, tokenHash: hashToken(rawToken) };
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
