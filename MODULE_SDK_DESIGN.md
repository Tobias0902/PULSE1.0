# PULSE Module SDK — Design Document (Decision #7)

**Status: DRAFT — for review only. Nothing in this document is implemented. No code has been written.**

Scope: the real, versioned Module SDK required by CLAUDE.md Decision #7 ("Module
boundaries and extension architecture"). This design is **additive to, not a
replacement for**, the compile-time module mechanism already present in this
repo (`packages/module-contracts`, `module-descriptors.ts`,
`ModuleRegistryService`, `ModuleActivationService`, `EventBusService` /
`EventDispatcherService`, the multi-module migration runner). Calendar
remains the reference module this SDK is designed against and, per the task
that requested this document, is the intended first module migrated onto it
once this design is approved.

## 0. Baseline — what already exists today

- **`ModuleDescriptor`** (`packages/module-contracts`): `id`, `name`,
  `version`, `sdkVersion`, `isCore`, `dependsOn`, `permissionKeys`,
  `postgresSchema`, `migrationsFolder` — compile-time, hand-registered in
  `module-descriptors.ts`.
- **Registration**: `ModuleRegistryService.sync()` upserts every descriptor
  into the `modules` table on boot; `validateDescriptors()` enforces unique
  ids, `sdkVersion` membership in `SUPPORTED_SDK_VERSIONS`, and mandatory
  `<moduleId>:` prefixing of non-Core permission keys.
- **Activation**: `ModuleActivationService` provides per-organization
  activation (`organizationModules` table) with dependency-aware
  activate/deactivate, optimistic concurrency, audit logging, and
  `module.activated`/`module.deactivated` domain events.
  `ModuleActiveGuard` + `@RequireModule()` enforce it per route.
- **Schema/migrations**: each module owns a distinct Postgres schema
  (`core`, `calendar`) and its own Drizzle migrations folder plus its own
  migration-tracking table (`__drizzle_migrations_<id>`), applied in
  sequence by one shared runner (`migrate.ts`).
- **Events**: `EventBusService` is an in-process pub/sub map plus a
  transactional-outbox `domainEvents` table; `EventDispatcherService`
  polls and delivers at-least-once, per-row error isolation, retry up to
  5 attempts, `FOR UPDATE SKIP LOCKED` for safe concurrent dispatch.
- **Cross-module calls today**: a module imports Core's (or another
  module's) whole NestJS `Module` directly to get DI access to its
  services — e.g. `CalendarModule` imports `CustomersModule` and
  `LocationsModule` in full.

**Gaps against Decision #7 that this design addresses:** no
capability-contract layer (a module gets full DI access to whatever it
imports, not a declared/enforced subset); no build-time rule preventing one
module's code from importing another module's schema file directly (only
Postgres-schema naming + convention prevent it today); no distinction yet
between how first-party and a future third-party module would be treated;
no destructive-removal ("uninstall") path, only activate/deactivate.

## 1. Versionierung von Modulen und Kompatibilitätsregeln

- Keep `sdkVersion` as the compatibility gate, but document
  `SUPPORTED_SDK_VERSIONS` explicitly as "the set Core currently accepts,"
  with a deprecation window before an old version is dropped — this should
  reuse whatever policy CLAUDE.md's still-open "concrete API versioning
  policy" item eventually settles, not invent a second, parallel policy.
- Module `version` (semver) stays informational/display metadata, as today.
  No automatic dependency-version resolution is proposed (`dependsOn`
  stays id-only) — more machinery than today's hand-registered, single-
  installation reality needs; can be added later without breaking this
  shape.
- `validateDescriptors()` keeps failing loudly at boot on an unsupported
  `sdkVersion` (already true today) rather than degrading silently — this
  design documents that behavior as the permanent contract, unchanged.

## 2. Lifecycle (Registrierung, Aktivierung, Deaktivierung, Deinstallation)

- **Registrierung**: unchanged — a descriptor is added to
  `MODULE_DESCRIPTORS` at compile time; `sync()` upserts it and its
  permission keys on every boot. Single source of truth, no new path.
- **Aktivierung/Deaktivierung**: unchanged — today's
  `ModuleActivationService` already satisfies Decision #7 §11 ("a module
  can be disabled without deleting its data"): per-organization,
  dependency-checked, audited, versioned, event-emitting.
- **Deinstallation (new)**: no destructive-removal path exists today. This
  design adds one as a distinct, explicitly audited administrative action
  (Decision #7 §11), separate from deactivation: only permitted once a
  module is deactivated for every organization, requires a second explicit
  confirmation, and is scoped to dropping *only* that module's own Postgres
  schema and migration-tracking table — never cascading into Core's or
  another module's schema.

## 3. Modul-eigene Schemas und Migrationen (isoliert vom Core-Schema)

- Already solid at the SQL level (per §0) — kept as-is.
- **Gap to close**: `database/module-schemas.ts` hand-merges every module's
  Drizzle schema object into one `combinedSchema` so `db.query.*` works
  uniformly. Nothing today stops one module's source from importing
  another module's schema file directly and querying its tables through
  the raw Drizzle client — only Postgres-schema naming and review
  convention prevent it, not a build-time rule. Proposed: an ESLint
  boundary rule (this repo already runs a shared
  `packages/config/eslint.base.mjs` per package) forbidding any module's
  source from importing another module's `database/*.schema.ts` except
  through that module's own exported service layer. Core's schema stays
  importable only by Core. This operationalizes Decision #7 §17's
  "build-time checks preventing cross-module/Core internal imports."

## 4. Isolation zwischen Modulen (Fehler/Crash darf Core nicht gefährden)

- Today, first-party modules run in-process as ordinary NestJS providers.
  Nest's exception filters already contain an unhandled exception in a
  request handler without crashing the process, and
  `EventDispatcherService` already isolates a failing event handler
  per-row (one bad handler marks only that row's `attempts`/`lastError`
  and the batch continues) — reasonable in-process fault isolation
  already exists for both the request path and the event path.
- **Explicitly out of scope for this iteration**: process/container-level
  isolation. Per Decision #7 §13 this is specifically a
  *third-party/untrusted-module* concern, and no third-party module exists
  yet. This reconfirms — rather than resolves — CLAUDE.md's still-open
  "concrete isolation technology for third-party modules" item.
- Module boot / registration sync keeps failing loudly on a bad descriptor
  (already true today) — this design does not introduce any more
  permissive or silent fallback behavior anywhere.

## 5. Capability Contracts (was ein Modul deklarieren/anfordern darf)

This is the newest concept relative to what exists today. Currently a
module gets full DI access to any Core/module NestJS `Module` it imports —
there is no declared, checkable list of which specific cross-module
operations it actually uses.

**Proposed shape (design-level, no code):** each `ModuleDescriptor` gains
an explicit, declared list of the specific cross-module service
capabilities it *consumes* (e.g. "reads Customer address by id," "reads
Location by id" — the two things Calendar already actually calls) and,
symmetrically, the capabilities it *exposes* to other modules (e.g.
Calendar could later expose "read calendar events for a person" instead of
another module touching Calendar's schema). Registration-time validation
(extending `validateDescriptors()`) checks that a module only requests
capabilities some other active/compatible module actually declares as
exposed. This turns today's implicit "Calendar happens to import two Core
NestJS modules" into an explicit, checkable, self-documenting contract, and
gives the future connector/third-party-module case (Decision #7 §13,
Decision #8) a real boundary to enforce isolation against later.

This is declarative metadata plus a validation check, not a new runtime
call-dispatch mechanism — calls still happen via ordinary NestJS DI/service
methods as today; only the "may this module even ask for this" gate is new.

## 6. Modul-zu-Modul-Kommunikation und Events

- Two channels already exist and both remain the two sanctioned channels
  (no third mechanism introduced): synchronous in-process service calls
  (NestJS DI on an explicitly-exported service, as Calendar does today)
  for read/validate-style calls needing an immediate answer, and the
  transactional-outbox event bus for asynchronous, decoupled notification.
- **Proposed tightening**: pair this with §5 — a module's synchronous
  cross-module calls should only reach the specific exported service
  methods it declared as consuming, not an entire NestJS module's full
  provider surface. This operationalizes Decision #7 §7 ("through
  explicitly exported interfaces... must never import another module's or
  Core's internal implementation directly"), which today is only true by
  convention, not by any enforced boundary.
- Events: the existing `DomainEvent` / `PublishEventInput` / `EventHandler`
  contracts stay as the shape — no proposed change to at-least-once
  delivery, per-entity ordering by `occurredAt`, or dispatcher
  retry/backoff. Already matches Decision #7 §7 and Decision #8's
  subscriber-idempotency expectations.

## 7. APIs und Berechtigungen pro Modul

- **Permissions**: keep today's mechanism as-is — descriptor-declared
  `permissionKeys`, mandatory `<moduleId>:` prefix for non-Core modules,
  validated at registration, entering the shared Decision #4 catalog via
  `sync()`. No change proposed.
- **Routes**: today each module wires its own controllers directly into
  `AppModule`'s `imports` (compile-time), and OpenAPI composition happens
  automatically via `@nestjs/swagger` scanning those controllers — this
  matches Decision #7 §8's "API routes" registry conceptually, but
  registration is still "add it to `AppModule` by hand," not a declared
  registry entry on the descriptor. Proposed: extend `ModuleDescriptor`
  with a declared list of the route prefixes/controllers a module owns —
  purely checkable metadata (e.g. so a later tool can validate "this
  module only registers routes under its own prefix"), not a change to how
  NestJS actually wires routes.
- Module-scoped route gating stays exactly as today's `ModuleActiveGuard`
  + `@RequireModule()` pattern, unchanged.

## 8. Identische SDK-Behandlung für First- und Third-Party-Module

Per Decision #7 §15 ("First-party modules... use the same Module SDK and
registration mechanisms available to third-party modules — there is no
privileged internal-only extension path"), this design keeps exactly one
`ModuleDescriptor` shape and one registration/activation/versioning/
capability-contract mechanism, used identically by Core, Calendar, and any
future module regardless of author. The only difference is the isolation
boundary from Decision #7 §13: first-party modules run in-process (as
today); a third-party/untrusted module would need a stronger boundary
(separate process/container) communicating through the *same*
descriptor/capability/event contract. This design does not pick that
isolation technology (still an explicitly open item in CLAUDE.md) — it only
confirms the contract surface itself would not need to differ once chosen.

## 9. Compile-Time vs. Dynamic-Loading-Entscheidung

Explicitly left open, as instructed — this design does not decide it and
implements nothing that presupposes an answer. Everything proposed above
(capability contracts, route metadata, the uninstall flow) is written to
work unchanged under today's compile-time model, and would not need a
rewrite if a future decision moves to dynamic loading — the
descriptor/contract shape is the stable surface either way; only *how* a
descriptor's code becomes part of the running process would change.

## Non-goals (guardrails carried over from the task)

Not designed and not implemented by this document: Decision #11
(Responsibility & Routing), a Content Coordination module, External
Intelligence/Action Request, the Customer/AssistiveDevice migration into
the Decision #10 shape, OIDC/MFA/recovery, the relay, or any Dev
Console/desktop/mobile expansion. Also not implemented: any proposal above
— this entire document is design-only, pending review.

## Suggested implementation order (only once this design is approved)

1. Extend `ModuleDescriptor` with the capability-contract fields (§5) and
   route-ownership metadata (§7), plus their `validateDescriptors()`
   checks — additive, no behavior change for existing descriptors until
   they adopt the new fields.
2. Add the ESLint cross-module-schema-import boundary rule (§3).
3. Add the uninstall flow (§2) as a new, separately-audited administrative
   action.
4. Migrate Calendar's existing two Core service imports (`CustomersModule`,
   `LocationsModule`) onto the new capability-contract fields as the first
   real usage — the "migrate the existing Calendar module onto the new
   SDK" step already planned for after approval.
