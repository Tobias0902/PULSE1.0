import { eq } from "drizzle-orm";
import { Database } from "../database/database.provider";
import { permissions, rolePermissions, userRoles } from "../database/schema";

export async function resolveUserPermissions(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));

  return [...new Set(rows.map((row) => row.key))];
}
