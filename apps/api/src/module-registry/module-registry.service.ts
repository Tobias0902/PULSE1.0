import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ModuleDescriptor } from "@pulse/module-contracts";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { modules, permissions } from "../database/schema";
import { MODULE_DESCRIPTORS } from "./module-descriptors";
import { SUPPORTED_SDK_VERSIONS } from "./sdk-version";

@Injectable()
export class ModuleRegistryService implements OnModuleInit {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async onModuleInit() {
    await this.sync(MODULE_DESCRIPTORS);
  }

  // Split from onModuleInit so it can be exercised directly in tests
  // against a synthetic descriptor list, without booting the whole app or
  // touching the real compiled-in descriptor array.
  async sync(descriptors: ModuleDescriptor[]): Promise<void> {
    validateDescriptors(descriptors);
    for (const descriptor of descriptors) {
      await this.db
        .insert(modules)
        .values({
          id: descriptor.id,
          name: descriptor.name,
          version: descriptor.version,
          sdkVersion: descriptor.sdkVersion,
          isCore: descriptor.isCore,
          dependsOn: descriptor.dependsOn,
          postgresSchema: descriptor.postgresSchema,
        })
        .onConflictDoUpdate({
          target: modules.id,
          set: {
            name: descriptor.name,
            version: descriptor.version,
            sdkVersion: descriptor.sdkVersion,
            isCore: descriptor.isCore,
            dependsOn: descriptor.dependsOn,
            postgresSchema: descriptor.postgresSchema,
            updatedAt: new Date(),
          },
        });

      // This is the canonical place a module's permission keys enter the
      // shared catalog (Decision #4 §3-4) — not just the dev-only seed
      // script, which never runs in production (see seed.ts). Without
      // this, a module shipped to a real installation would have no way
      // for any role to ever be granted its permissions.
      if (descriptor.permissionKeys.length > 0) {
        await this.db
          .insert(permissions)
          .values(
            descriptor.permissionKeys.map((key) => ({ key, description: `${descriptor.name}: ${key}` })),
          )
          .onConflictDoNothing();
      }
    }
  }

  listAll() {
    return this.db.query.modules.findMany();
  }
}

// Pure validation, exported so it can be unit tested directly against
// synthetic descriptor lists without a database.
export function validateDescriptors(descriptors: ModuleDescriptor[]): void {
  const seenModuleIds = new Set<string>();

  for (const descriptor of descriptors) {
    if (seenModuleIds.has(descriptor.id)) {
      throw new Error(`Duplicate module id "${descriptor.id}" is declared by more than one descriptor.`);
    }
    seenModuleIds.add(descriptor.id);

    if (!SUPPORTED_SDK_VERSIONS.includes(descriptor.sdkVersion)) {
      throw new Error(
        `Module "${descriptor.id}" targets SDK version "${descriptor.sdkVersion}", which this ` +
          `installation does not support (supported: ${SUPPORTED_SDK_VERSIONS.join(", ")}).`,
      );
    }

    // Every non-core module must prefix its own permission keys with its own
    // id. Because different modules necessarily have different ids, this
    // rule alone makes cross-module key collisions structurally impossible
    // for well-formed descriptors — there is no separate "same key claimed
    // by two modules" case left to check once ids are unique and prefixes
    // are enforced.
    for (const key of descriptor.permissionKeys) {
      if (!descriptor.isCore && !key.startsWith(`${descriptor.id}:`)) {
        throw new Error(
          `Module "${descriptor.id}" declares permission key "${key}", which must be prefixed ` +
            `with "${descriptor.id}:" to avoid colliding with another module's namespace.`,
        );
      }
    }
  }
}
