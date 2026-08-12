# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Architecture Decisions #1–#9 below are locked. The first implementation iteration (PULSE-Core foundation only — see "Commands" and README.md) is in place: the pnpm/Turborepo monorepo, the NestJS/Drizzle/PostgreSQL backend, the initial domain model (Organization/Location/User/Role/Permission plus the Customer -> AssistiveDevice -> Case -> Appointment hierarchy), REST + OpenAPI, an audit-event foundation, and a throwaway dev/admin UI (`apps/dev-console`, explicitly not the final Cockpit). This is still foundation-only: no Module SDK, connectors/integration layer, relay, OIDC/MFA, or real product UX yet — see "Open decisions" below for what remains genuinely undecided.

Do not invent a finished architecture or begin implementing further application features beyond what's already here until any relevant open decision below has been resolved with the user. When a domain or architecture question is unclear, say so explicitly (or ask) rather than silently deciding it.

## What PULSE is

PULSE is a professional, modular software platform for orthopaedic technology and medical supply companies, intended as a long-lived commercial product — not a prototype, demo, or task tracker.

Core philosophy: **"PULSE adapts to the company — the company does not have to adapt to PULSE."** It must be modular, configurable, and integration-friendly, connecting to existing company processes and ERP/industry systems rather than unnecessarily replacing them.

### Product goal

PULSE will eventually unify capabilities currently spread across separate tools: task/project management, CRM, documentation, calendar, communication, dictation/AI assistance, and quality management.

The product is structured as a stable **PULSE-Core** plus optional modules.

**PULSE-Core** should eventually provide:
- Users, authentication, roles and permissions
- Organizations/tenants
- Customer and lead management
- Projects, boards and configurable workflows
- Tasks, subtasks, checklists, comments and attachments
- Customer/case records
- Calendar functionality — kept logically separate from workflow tasks/cases, not merged into the same model
- Notifications
- Auditability
- Configuration and company-specific customization
- Integration/API infrastructure

**Future modules** may include:
- PULSE Calendar — user/employee-centered calendar module; the platform-wide appointment/event authority (Decision #9)
- PULSEHuman — internal employee application (messaging, reviews, goals, vacation/absence, shift planning); explicitly not CRM/ERP and holds no customer data
- PULSE-QM — quality management, processes, knowledge, continuous improvement
- PULSE-AI — dictation, summarization, assistance, analysis
- Communication integrations (email, messaging)
- Integrations with existing ERP/industry software
- Document and data import/export
- Additional specialist modules

### First deployment vs. product scope

The first real installation will validate PULSE inside an actual orthopaedic technology business. The architecture must nonetheless stay generic enough to become a multi-customer product — do not let decisions collapse into a company-specific custom application.

## Non-negotiable architectural requirements

- **Not Mac-only.** Development happens on macOS, but the shipped system must support Windows desktop, macOS desktop, iOS, Android, web browsers where appropriate, server deployments, customer-owned/local server infrastructure, and potentially cloud-hosted deployments. Avoid unnecessary platform lock-in.
- **Server is authoritative.** The server/backend owns shared business data; clients synchronize with it. Offline capability may exist later as a controlled fallback, but avoid uncontrolled parallel offline states or silent conflict resolution.
- **API-first.** UI clients and integrations talk to stable, documented interfaces — never couple directly to database internals.
- **Modular.** Core domain functionality, optional modules, integrations, and UIs need clear boundaries.
- **Deployed as independent installations, not a shared multi-tenant database** — see "Data residency and sovereignty" below. "Multi-tenant from the architecture level" for PULSE means the software must cleanly support many independent customer installations, and, within one installation, potentially multiple internal organizations/departments of that one customer (open question, see Decision #2) — it does **not** mean many customers' operational data living in one PULSE-operated database.
- **First-class concerns:** security, privacy, data integrity, auditability, backups, migrations, maintainability — because PULSE handles sensitive operational and customer business data.
- Never put secrets, passwords, API keys, tokens, or real customer data into source control.
- Workflow structures, boards, process steps, labels, fields, and relevant automation should be configurable wherever technically reasonable — do not force one predefined workflow on every company.
- Existing industry/ERP systems should be connectable through a dedicated integration layer, not ad hoc point-to-point coupling.

### Data residency and sovereignty (binding)

- **Customer data stays within the infrastructure of the respective customer/company.** Each PULSE installation has its own local PostgreSQL database, physically within that customer's infrastructure.
- Customer data, end-customer data, employee data, cases, documents, appointments, notes, health-related data, configuration data, and other operational data must **never** be stored in a central PULSE-operated database.
- PULSE, as the software vendor, has **no routine access** to customer operational data.
- A future central PULSE service may exist only for software distribution, updates, licensing, module activation, and strictly separated technical metadata (e.g. installation IDs, license/entitlement state, version info). It must be architecturally and physically separated from operational customer data, and must not be designed in a way that could accidentally receive operational data.
- The architecture is designed **primarily as customer-hosted/on-premise**, while still allowing secure remote access for the customer's own authorized users and mobile devices.
- A future optional cloud deployment model must preserve isolated, customer-controlled data storage (e.g. a dedicated, isolated instance per customer) and must **not** silently become a conventional shared multi-tenant SaaS database.

## Development priorities

Optimize for, in this order of emphasis: maintainability, security, reliability, testability, modularity, portability, clear domain boundaries, controlled evolution of the database and APIs, professional deployment/update mechanisms, and long-term maintainability by a professional team — never for the fastest possible prototype.

- Prefer a well-structured modular monolith over premature microservices unless there is a strong, stated technical reason otherwise.
- Don't introduce technologies because they are fashionable.
- Don't make irreversible architecture decisions without explaining the trade-offs.
- Don't silently invent business requirements — document the uncertainty or ask.

## Architecture decisions

### Decision #1 — Technology stack (LOCKED, 2026-08-09)

- Primary language: TypeScript, used across backend, web, desktop and mobile
- Backend: Node.js + NestJS
- Web client: React + TypeScript
- Desktop client: Tauri + React, targeting Windows and macOS
- Mobile client: React Native + TypeScript, targeting iOS, iPadOS and Android
- Repository structure: monorepo using pnpm workspaces + Turborepo
- Shared TypeScript packages hold domain types, validation schemas, API contracts/clients, and platform-independent business logic, reused across backend and all clients
- Architecture style: modular monolith with strict module boundaries (NestJS's module/DI system is the primary enforcement mechanism); microservice extraction is a possible future step for a specific module, not a starting point
- The backend/server remains authoritative for business data; desktop, web and mobile are clients of PULSE-Core and must never become the authoritative source of business data
- Flutter was evaluated and explicitly **not selected** — it would break TypeScript-wide code sharing (domain types, validation schemas, business logic) between backend and all clients, in exchange for UI-layer consistency that was judged not worth that trade-off

**Follow-up #1 — Tauri/WebView2 compatibility spike (required before desktop is considered production-validated).** Tauri renders through the OS-native webview (WebView2 on Windows, WKWebView on macOS) rather than a bundled browser. Before relying on this for customer deployment, validate WebView2 presence/updateability on realistic, IT-locked-down Windows customer environments. **Electron is the designated fallback desktop shell** if Tauri/WebView2 proves materially unsuitable — the React/TS application code would carry over largely unchanged; only the native shell would change.

**Follow-up #2 — Node.js LTS/runtime and update policy (to be defined together with the deployment architecture).** Customer installations must not depend on customers manually installing or maintaining Node.js — the runtime needs to be bundled, containerized, or otherwise fully managed by PULSE's install/update mechanism. This must be resolved alongside the deployment-model decision, not independently.

### Decision #2 — Database/tenancy model (LOCKED, 2026-08-09)

Superseded the shared-cluster tenancy comparison originally explored for this decision. That comparison (row-level tenant_id, schema-per-tenant, or database-per-tenant *within one Postgres cluster operated by PULSE*) assumed a central, PULSE-operated database holding operational data for multiple customers. The binding data-residency principle above rules that assumption out entirely — even a database-per-tenant pattern on a shared PULSE-operated cluster would still mean PULSE-controlled infrastructure and standing administrative access to a system containing every customer's operational data, which the principle forbids.

**Locked model: database-per-installation.** Every PULSE installation — one per customer — runs its own dedicated PostgreSQL database, physically located within that customer's own infrastructure for on-premise deployments. There is no PULSE-operated database that stores or transits operational data for more than one customer, ever. "Multi-tenancy" for PULSE as a product is achieved by replicating independent, isolated installations, not by a shared database engine.

Consequences to design for (each also tracked as an open decision below where unresolved):

- **Deployment.** Each installation is a full, self-contained PULSE-Core stack (app + PostgreSQL) inside the customer's infrastructure. Because PULSE will need to install and operate many independent stacks over time rather than one shared system, a repeatable, low-touch install/update artifact (e.g. a containerized bundle) is essential — this elevates the existing "professional deployment and update mechanisms" priority to central importance.
- **Central PULSE service.** Scope is strictly limited to distribution, updates, licensing, module activation, and technical metadata (installation ID, version, entitlements). It must be a structurally separate system/database from any operational data, ideally unable by schema design to hold business or personal data. Installations should reach it only for license/update/version checks, not data sync.
- **Updates/migrations.** Schema migrations run independently per installation rather than once centrally, which introduces real version-drift risk across installations updated at different times. Requires a versioned, automated per-installation migration mechanism, ideally with pre-migration backup, and reinforces the need for backward-compatible API/module versioning (see open decisions).
- **Backups.** Backup responsibility is per-installation. For on-prem, this is primarily the customer's own infrastructure responsibility, but PULSE should ship backup tooling/guidance since customers can't be assumed to have database administration expertise. For any future PULSE-hosted instance, backups must stay scoped to that one customer's isolated storage — never pooled with other customers'.
- **Mobile/remote access.** Since there is no central database, mobile and web clients must reach the specific customer's own PULSE-Core backend. This requires a defined secure remote-access mechanism per installation (e.g. customer-managed VPN/reverse proxy, or a PULSE-provided routing layer that only proxies encrypted traffic and never stores or has access to operational data at rest). Not yet decided — see open decisions.
- **Scalability.** Shifts from "scale one shared database" to "operate a growing fleet of independent installations" — a deployment/fleet-management problem (rollout tooling, health/version monitoring that sees only technical metadata) more than a database-scaling problem. Within a single installation, standard single-tenant PostgreSQL scaling applies, sized to that one customer.
- **GDPR/data protection.** This model is the strongest available answer to data-sovereignty concerns: operational and personal data physically stays within the customer's own controlled infrastructure and jurisdiction, and PULSE has no routine access to it, which substantially simplifies PULSE's role and obligations as a vendor.

### Decision #3 — API architecture and versioning (LOCKED, 2026-08-09)

Binding principles:

1. REST is the primary API architecture for PULSE.
2. OpenAPI is the canonical API contract. Generated TypeScript clients are convenience layers derived from OpenAPI and must never become the canonical contract themselves.
3. PULSE clients must communicate with PULSE-Core through documented APIs and must never depend directly on PostgreSQL database internals.
4. Server-Sent Events (SSE) are the default mechanism for server-to-client real-time updates where appropriate.
5. WebSockets may be used only for features that genuinely require bidirectional real-time communication (e.g. future collaborative functionality, or other cases where SSE is insufficient).
6. GraphQL is not part of the default PULSE architecture. It may only be introduced later for a clearly justified, scoped use case.
7. RPC/tRPC/gRPC must not be the primary external API architecture, because PULSE must remain accessible to non-TypeScript integrations and external ERP/industry partners.
8. Internal and external/public integration APIs may have different stability and lifecycle guarantees, but both must follow documented, versioned contracts.
9. External/public integration APIs must be structurally separated from internal application APIs, so undocumented internal endpoints cannot accidentally become permanent third-party dependencies.
10. PULSE must support independently deployed customer installations running temporarily different software/API versions during controlled update rollouts.
11. API backward compatibility and explicit versioning are mandatory architectural concerns.
12. Modules and integrations must extend PULSE through defined interfaces/contracts rather than direct access to database internals.

This decision was reached after evaluating REST, GraphQL, and RPC (tRPC/gRPC) against maintainability, typed contracts, versioning, backward compatibility, all client platforms, ERP/third-party integration, future modules, real-time needs, security, auditability, testing, documentation, external-partner onboarding, and multi-version-installation operation. REST+OpenAPI was the only option friendly to both non-TypeScript external integrators and many independently-versioned installations — GraphQL's schema-evolution philosophy and RPC's tight client/server coupling each conflict with those two locked constraints.

### Decision #4 — Authentication and authorization (LOCKED, 2026-08-09)

Binding principles:

1. Authentication is hybrid and pluggable per installation: PULSE-local username/password authentication (Argon2id-hashed, stored only in that installation's own database) is always available as the baseline, and OIDC against a customer-operated identity provider (e.g. Microsoft Entra ID, Google Workspace, Okta, generic OIDC) is available as an optional, per-installation-configurable strategy. Both may be enabled simultaneously for the same installation.
2. Authentication and authorization are separated and must remain so: whether a user authenticates via a local PULSE account or an external OIDC identity provider must never determine their PULSE permissions. A single local user/identity model (the anchor for roles, permissions, sessions and audit) sits behind whichever authentication strategy is used.
3. Authorization is fundamentally permission-based. Fine-grained permissions are the atomic unit of access control; roles are customer-configurable, named bundles of permissions provided purely for administration convenience, not a separate authorization mechanism.
4. PULSE ships with sensible predefined default roles so a new installation is usable immediately without the customer having to design an authorization model from scratch. These default roles are templates, not hard-coded business roles — customer administrators can modify them, create additional roles, and assign permissions to match their own organizational structure.
5. A customer installation must support multiple administrators. Normal day-to-day administration (creating/deactivating users, assigning roles/permissions) must never depend on the infrastructure-level emergency recovery mechanism.
6. Sessions/tokens use short-lived JWT access tokens plus server-side-tracked, individually and immediately revocable refresh tokens/session records per device, stored in the installation's own database, with secure platform-appropriate storage on each client (OS keychain on desktop/mobile, secure storage on web).
7. MFA is supported via TOTP for local accounts (administrator-enforceable) and is delegated to the customer's identity provider for OIDC-authenticated users.
8. Password recovery for local accounts is self-service via installation-sent email (using customer-configured SMTP) for the normal case.
9. An infrastructure-level emergency recovery mechanism (executed directly on the installation's own host, outside of PULSE's network-facing application) exists strictly as a last-resort path for total administrative lockout. It must never become a routine administration method or a vendor support backdoor, and PULSE as vendor holds no master credential or routine access that could perform it remotely.
10. All authentication- and authorization-related data — credentials, identity mappings, roles, permissions, sessions, MFA configuration, and authentication/audit logs — belonging to a customer installation remain within that customer's own controlled infrastructure, consistent with the Decision #2 data-sovereignty principle. PULSE as vendor has no master credentials and no routine access to any of it.
11. Sensitive actions and permission/role changes are recorded in a dedicated, locally-stored, append-only audit log (login events, token issuance/revocation, role/permission changes, user lifecycle changes), not editable or deletable through normal application permissions.

This decision adopts the hybrid authentication / permission-based authorization architecture evaluated against PULSE-local-only, external-IdP-only, and hybrid approaches, RBAC vs. permission-based vs. hybrid authorization, session/token strategy across desktop/mobile/web, MFA, password recovery, audit logging, emergency recovery, and future SSO/directory integration. It was chosen because it is the only approach that simultaneously works for customers without any identity provider, remains extensible to enterprise SSO without redesigning PULSE-Core, and keeps all identity and authorization data within customer-controlled infrastructure with no PULSE-operated identity system or vendor backdoor.

### Decision #5 — Secure remote and mobile access (LOCKED, 2026-08-09)

Binding principles:

1. Every PULSE installation remains fully functional on the customer's local network without any dependency on PULSE-operated infrastructure.
2. The default remote-access method is a PULSE-operated outbound-only relay/tunnel architecture designed for customers without dedicated IT staff.
3. The customer installation initiates the outbound connection. No inbound router port or direct public exposure of the customer's PULSE server is required for the default configuration.
4. The PULSE relay must be a blind transport layer only. It must never terminate application TLS, decrypt, inspect, cache, persist, transform, or log operational application payloads.
5. End-to-end TLS encryption terminates only between the authorized PULSE client and the customer's own PULSE-Core installation. Private keys required to decrypt operational traffic must never exist in PULSE-operated infrastructure.
6. Mutual TLS or an equivalent cryptographically strong mechanism should provide additional device/connection authentication where appropriate.
7. PULSE-operated relay infrastructure may process only the minimum technical connection metadata required to route and operate the service. It must never receive operational customer data.
8. PostgreSQL and internal PULSE services must never be remotely exposed. Only the defined PULSE-Core API surface may be reachable.
9. REST/OpenAPI, SSE and, where required, WebSockets must remain compatible with the remote-access architecture.
10. Customer-managed VPN access must remain fully supported as an alternative deployment mode.
11. Customer-managed direct HTTPS/reverse-proxy access must remain supported as an alternative deployment mode for customers with suitable IT infrastructure.
12. The access mode is configurable per installation. PULSE must not force the PULSE-operated relay on customers.
13. Failure or unavailability of the PULSE relay affects remote connectivity through that relay only. It must never affect local operation of PULSE-Core.
14. Licensing, update, telemetry, relay or other future PULSE-operated services must never become runtime dependencies required for local PULSE operation.
15. PULSE as vendor must have no remote administrative backdoor into customer installations.
16. Individual remote devices and sessions must be revocable without affecting other users or devices.
17. Certificate and key rotation must be supported without requiring reinstalling the customer installation.
18. The relay architecture should be deliberately minimal, isolated from other PULSE services, security-auditable, and designed so that independent verification of the no-decryption architecture is possible.
19. Remote-access architecture must preserve the data-sovereignty principles established in Decision #2 and the authentication/authorization principles established in Decision #4.

Trust boundary (explicit):

```
Customer operational data:
Client <---- end-to-end encrypted ----> Customer PULSE-Core

PULSE Relay:
routing/transport only
no plaintext
no operational database
no customer credentials
no decryption keys
no vendor administrative access
```

This decision adopts a hybrid remote-access architecture: a PULSE-operated outbound-only, TCP/SNI-passthrough relay (never TLS-terminating, optionally reinforced with mutual TLS) as the zero-config default for customers without dedicated IT staff, with customer-managed VPN and customer-managed direct HTTPS/reverse-proxy exposure both fully supported as alternative, per-installation-configurable modes. Local/LAN operation of PULSE-Core never depends on any PULSE-operated service. Authentication/authorization (Decision #4) and the API/real-time architecture (Decision #3) are unaffected by and independent of which access mode is used.

### Decision #6 — Synchronization and offline strategy (LOCKED, 2026-08-09)

**Fundamental model:**

- PULSE is online-first and server-authoritative. The customer's own PULSE-Core installation is always the authoritative source of truth.
- Offline capability is a controlled fallback, not a second independent operating mode.
- PULSE must never silently merge conflicting business data, and must never silently overwrite newer server data with stale client data.
- Correctness, transparency, and auditability are prioritized over seamless but ambiguous synchronization.

Binding principles:

1. Online-first, server-authoritative operation applies to all data types. The local read cache and offline write queue are conveniences layered on top of this, never a replacement for it.
2. A universal local read cache exists on clients: scoped and minimized, encrypted at rest using platform-appropriate mechanisms, intended only for continuity during temporary connectivity loss, and must never become a complete local replica of the customer's operational database.
3. A controlled offline write queue is restricted to an explicit allowlist of operations safe to queue offline, initially: notes/comments; checklist-item completion; timer start/stop events; offline-captured attachments/documents; future dictated notes/media where applicable.
4. Shared mutable operational state requires live connectivity and must not be freely editable offline, initially including: customer/master data; case/task status; assignments; calendar/appointments; workflow structure; and other state where concurrent changes could create operational ambiguity.
5. Entity/version-based optimistic concurrency is the default conflict-detection mechanism. Updates must carry the version/state they were based on; the server rejects stale conflicting updates rather than overwriting newer state; there is no silent automatic winner selection.
6. Pessimistic locking may be used only for specifically identified high-friction editing scenarios where loss of work would be unacceptable. It is an exception, not the general synchronization model, and locks must have bounded timeouts and recovery behavior.
7. CRDTs and full event sourcing are explicitly rejected as the general PULSE synchronization/data architecture. They may only be reconsidered later for a narrowly justified, scoped feature.
8. On reconnect: queued writes are replayed in controlled order; every queued operation uses an idempotency key; conflicts are surfaced individually, never auto-resolved; SSE/real-time state is resumed where practical or fully refreshed when required; API/server version compatibility is checked before flushing queued writes after an extended offline period.
9. Documents/attachments: metadata may be cached; file content is normally loaded on demand; users may explicitly make selected documents/files available offline; offline-created attachments may enter the controlled write queue; PULSE must not silently build a complete offline document mirror.
10. Timers: offline timer activity is represented as discrete timestamped start/stop events, synchronized later; durations are calculated from timestamps; PULSE must not rely on continuously synchronized counters.

**User-visible synchronization states (binding):** PULSE must never give the user a false impression of synchronization. The client must clearly distinguish at least these states where relevant:

- **A. ONLINE / SYNCHRONIZED** — the latest relevant state has been confirmed by the customer's PULSE-Core.
- **B. OFFLINE** — the client currently cannot reach the customer's PULSE-Core. Cached information may still be displayed, but the UI must clearly indicate that it may no longer represent the latest server state.
- **C. PENDING SYNCHRONIZATION** — a user action has been stored locally and queued, but has not yet been accepted and confirmed by PULSE-Core. The UI must not present this as fully synchronized/saved server state.
- **D. CONFLICT / ACTION REQUIRED** — PULSE-Core has rejected or cannot safely apply a queued/local change because the authoritative server state changed. The user must be clearly informed and must explicitly resolve the conflict.

Additional binding rules:

- "Saved locally" and "synchronized with PULSE-Core" are distinct states, always presented as such.
- A queued offline write must remain visibly pending until server confirmation.
- Failed synchronization must never silently discard user-entered information.
- Conflicting information must never be silently merged or overwritten.
- Where a conflict requires human judgment, PULSE must present both relevant states/context and let an authorized user decide how to proceed.
- Cached data shown after connectivity loss must carry sufficient freshness/staleness information so the user can understand it may be outdated.
- After extended offline periods, PULSE should refresh authoritative state before allowing new shared-state decisions where stale data could create operational risk.
- Synchronization status must be understandable to normal employees without technical knowledge; users should not need to understand databases, queues, versions, or networking.

This decision maintains compatibility with all locked decisions #1–#5: it introduces no central operational data store (all cache/queue state is local to the client device and the customer's own installation, per Decision #2), keeps PULSE-Core server-authoritative, operates entirely over the REST/OpenAPI + SSE architecture of Decision #3, leaves authentication/authorization (Decision #4) unaffected, and is transport-agnostic with respect to the remote-access architecture of Decision #5.

### Decision #7 — Module boundaries and extension architecture (LOCKED, 2026-08-09)

**Fundamental model:**

- PULSE-Core is a modular monolith (Decision #1) with strict module boundaries enforced through a formal, versioned Module SDK — not just convention.
- Core stays a narrow, industry-neutral technical foundation. All business-specific and industry-specific semantics live in modules, configuration, or integrations, never in Core itself.
- "Everything can, nothing must": customer adaptation happens through configuration, module selection, module configuration, and integrations — never through customer-specific forks of Core's source code.

Binding principles:

1. PULSE-Core remains a stable, narrow foundation providing only cross-cutting primitives and mechanisms needed by virtually every installation and by other modules: users/authentication/authorization, organization/company configuration, core customer/contact and case/task/board/workflow primitives, generic time/scheduling primitives (see principle 2), comments/notes/attachments, notifications, search, audit logging, and the module extension mechanism itself. Core must not accumulate feature-specific or industry-specific functionality that belongs in a module.
2. PULSE-Core may provide generic time and scheduling primitives that other modules can depend on: dates/times, time ranges, resources, generic availability primitives, associations to users/contacts/cases, and shared notification/reminder mechanisms where appropriate. Richer appointment-management and scheduling workflows — including appointment types, industry-specific durations, resource rules, booking workflows, customer-specific scheduling rules, or orthopaedic-technology-specific appointment semantics — must remain an optional first-party module, never hardcoded Core business logic.
3. External calendar systems (e.g. Microsoft 365/Outlook, Google Calendar, Apple Calendar, or comparable systems) are integrations through the integration layer, never native Core or module functionality.
4. Generic Core primitives must remain semantically neutral. Core may provide primitives such as Contact, Case, Task, Board, Workflow/WorkflowState, Resource, TimeSlot, Document, Attachment, Comment, and Notification, but must not encode industry-specific or customer-specific business semantics (e.g. prosthetic fitting, maintenance, cost estimate, prescription, health insurer approval, trial fitting, delivery, or orthopaedic-technology-specific workflow stages). Such semantics belong in configuration, first-party modules, industry modules, or integrations. PULSE-Core must remain industry-neutral enough that the same technical foundation supports different organizational workflows without source-code forks.
5. All optional functional areas (CRM, appointment-management workflows, PULSE-QM, PULSE-AI, reporting/KPI, industry-specific workflows, and future functional areas) are implemented as modules, not as part of Core.
6. Connections to external third-party systems (ERP systems such as OT-Win, email, external calendar systems, document systems, messaging, scanning/dictation services) are implemented as integrations through a dedicated integration layer, never as native modules embedded in PULSE's own domain model.
7. PULSE-Core and modules communicate through a versioned Module SDK: in-process service calls through explicitly exported interfaces, and an internal event bus for asynchronous, decoupled notification. Modules must never import another module's or Core's internal implementation directly.
8. Modules register with Core, and with each other, only through Core-provided generic registries: permissions (into the Decision #4 shared catalog), API routes (composed into the Decision #3 REST/OpenAPI surface), UI/navigation entries, background jobs, database migrations, event subscriptions, and configuration schemas. Core must never hardcode knowledge of a specific module.
9. Each module owns its own PostgreSQL schema within the customer installation's single database (Decision #2). Modules must never directly query or modify another module's or Core's tables; all cross-module data access goes through the SDK's service/event mechanisms.
10. Core's own data integrity must never depend on a specific module being installed or enabled — Core must not hold hard structural (e.g. foreign-key) dependencies into a module's schema.
11. A module can be disabled without deleting its data — its registrations become inactive and its schema remains dormant. Actual data removal requires a separate, explicit, audited administrative action.
12. First-party modules, built and vetted by PULSE, may run in-process within PULSE-Core, subject to the same engineering and review standards as Core itself.
13. Third-party or otherwise untrusted modules must not run inside the PULSE-Core process by default. They require a stronger isolation boundary (a separate process/service communicating through the same SDK contract), given the sensitivity of customer operational data.
14. The Module SDK is explicitly versioned. PULSE-Core declares which SDK version(s) it supports; each module declares the SDK version it targets; Core must refuse to activate an incompatible module with a clear error rather than degrade silently.
15. First-party modules built by PULSE use the same Module SDK and registration mechanisms available to third-party modules — there is no privileged internal-only extension path.
16. Customer-specific adaptation is achieved, in order of preference: (a) configuration, (b) module selection and per-module configuration, (c) integration configuration, and only as a last resort (d) an isolated, SDK-based add-on module. PULSE-Core's own source code must remain identical across all customer installations — no customer-specific forks.
17. Module and Core boundaries are enforced not only by convention but by tooling — build-time checks preventing cross-module/Core internal imports, and database-level permission scoping preventing a module's runtime credentials from accessing another module's or Core's schema.
18. Extraction of a specific module into an independently deployable service remains a possible future step (per Decision #1) only where there is a concrete, justified technical reason — such as untrusted-third-party isolation (principle 13) or a genuinely different resource/scaling profile — never as the default or general module architecture.

This decision gives Decision #1's "modular monolith with strict module boundaries" a concrete enforcement mechanism (the Module SDK and schema-per-module ownership), keeps PULSE-Core industry-neutral so the same technical foundation can serve different organizational workflows without forks, and routes all customer- and industry-specific semantics into configuration, modules, or integrations. It remains compatible with all locked decisions #1–#6: no shared central database (#2), REST/OpenAPI composition and SSE (#3), the shared permission catalog (#4), no change to remote-access architecture (#5), and one coherent versioning/conflict model across all modules (#6).

### Decision #8 — Integration layer (LOCKED, 2026-08-09)

**Fundamental model:**

- PULSE adapts to a customer's existing software landscape rather than requiring its replacement — but integration must never turn PULSE into a generic mirror or frontend for an external system. PULSE remains a system with its own domain.
- For every integrated data domain, PULSE explicitly knows which system is authoritative. Bidirectional synchronization must not mean two systems silently become competing sources of truth.
- Authority is assigned per data entity or coherent logical data group by default; field-level authority is permitted only as a justified, explicit exception, never the norm.
- OT-Win is an important first real-world integration case but does not define the architecture — the same architecture must equally accommodate modern REST-based systems, and systems with no real API at all.

Binding principles:

1. Integrations with external third-party systems are implemented as connectors — SDK-registered extensions, structurally similar to modules but restricted to translation and synchronization; a connector must never introduce new PULSE business concepts or become an alternate store of business data.
2. Every connector implements one uniform contract (pull, push, mapping functions, declared capabilities, declared credential/config schema) regardless of the external system's actual interface shape — legacy, file-based, or modern REST systems all present the same shape to Core and the sync engine.
3. For every integrated data domain, the responsible system (PULSE or the external system) must be explicitly declared as authoritative. Authority is assigned by default at the level of a data entity or coherent logical data group (e.g. "ERP-owned billing/customer-master information" as a whole), not at the level of individual, arbitrarily chosen fields. Field-level authority is permitted only as an explicit, justified configuration exception for a specific integration need — never the default model — to avoid fragmented ownership that makes a business object impossible for users and developers to reason about.
4. PULSE remains a system with its own domain, not a generic mirror or frontend for an external system. PULSE-Core and modules remain authoritative for PULSE-native operational domains, including but not limited to: cases/processes, boards and workflow state, tasks and assignments, comments and internal collaboration, PULSE-native documentation, timers, QM/KVP information, PULSE-specific CRM information, and other module-owned operational data. Integrating with an external system must never implicitly make that system authoritative for PULSE-native operational state.
5. External systems may be declared authoritative only for specific external/business data domains, for example: billing-relevant ERP data, insurer/payer master data, ERP-owned customer master data where configured, and accounting or external-system-specific identifiers. A connector may translate, synchronize, reference, or enrich PULSE-native domains according to declared ownership, but ownership of PULSE-native operational domains does not transfer merely because a connector exists.
6. One-way synchronization is the default per data domain/group; bidirectional synchronization is used only where justified and must still respect entity/group-level ownership, with field-level exceptions permitted only per principle 3.
7. PULSE must not duplicate external data without a defined operational reason. Connectors should prefer references or synchronized subsets of external data over indiscriminate, complete copies of external databases.
8. Connectors translate between an external system's own vocabulary and PULSE-Core's/modules' neutral primitives (Decision #7). Vendor- and industry-specific semantics are absorbed entirely within the connector's mapping layer and must never leak into Core or module domain models.
9. Inbound synchronization writes to Core/module data go through the same entity-version optimistic-concurrency and conflict-surfacing mechanism as any other write (Decision #6). Synchronization must never silently overwrite a conflicting local change outside that mechanism.
10. Duplicate prevention relies on a stable, connector-owned external-ID-to-internal-ID mapping with idempotent upsert. Heuristic/fuzzy matching may be used only for one-time, human-reviewed initial reconciliation, never as an ongoing automatic mechanism.
11. Every connector operation is idempotent and retried with bounded backoff; persistent failures become a visible integration error, never a silent drop or an infinite retry loop.
12. All connector credentials and secrets are stored only within the installation's own local database, encrypted at rest, and are never transmitted to or held by any PULSE-operated service. OAuth flows complete directly between the local installation and the external provider.
13. Connectors are trigger-agnostic in contract: webhook, polling, scheduled import/export, file-based, and manual triggers are all valid invocation mechanisms for the same pull/push contract. Webhook-based connectors reuse the existing PULSE relay mechanism (Decision #5) where enabled; where no inbound path exists, connectors degrade to polling rather than requiring a new inbound-exposure mechanism.
14. Connectors register with Core and modules only through the same generic SDK registries used by modules (schema, configuration, permissions, background jobs, event subscriptions/publications) — never through direct, undeclared coupling to Core or module internals.
15. Connector synchronization always runs as an isolated background job, never inline in a user-facing request path, with per-connector timeouts and circuit-breaker behavior so a failing or slow external system cannot degrade PULSE-Core's own availability or unrelated functionality.
16. Third-party or otherwise untrusted connectors must not run inside the PULSE-Core process by default and require the same stronger process isolation boundary already established for untrusted modules (Decision #7, principle 13).
17. Each connector maintains a locally visible status (last successful sync, last error, pending operations); integration-driven changes to business data are recorded in the audit log with clear attribution to the originating connector; per-record sync failures are surfaced near the affected record, not only in a system log.
18. Connectors declare the specific external API/format version they target and must fail into a visible degraded state rather than silently misinterpreting an unexpected response shape; connector updates should be able to ship independently of a full PULSE-Core release where practical, reusing Decision #7's Module SDK versioning mechanism.
19. Which connectors are enabled, their credentials, field/group mappings, source-of-truth declarations, and trigger configuration are per-installation configuration, never a customer-specific connector fork. A new external system requires a new connector built against the public contract, not a modification to PULSE-Core.
20. The integration layer introduces no new data processor into the customer's GDPR/data-protection relationships — all synchronized content, mappings, and credentials remain inside the customer's own installation; a connector to a customer's existing cloud service does not route through any PULSE-operated infrastructure.
21. PULSE-Core's own local operation must remain fully functional regardless of the availability of any external system; unavailable integrations degrade to queued/paused sync, never to Core unavailability or data loss.
22. No enterprise integration platform, message broker, or microservice fleet is part of the default architecture. Such infrastructure may only be introduced later for a specific, concretely justified case — not as the general integration mechanism.
23. OT-Win is treated as one connector instance validating this architecture, not as a design input that shapes it; the architecture must equally accommodate modern REST-based systems (Microsoft 365, Google Calendar), and import/export-only systems with no real API, without special-casing any of them at the Core or SDK level.

This decision extends Decision #7's Module SDK to a new, semantically restricted extension category (connectors), rather than introducing a parallel extension mechanism. It preserves compatibility with all locked decisions #1–#7: no shared central database or PULSE-operated data path (#2), synchronization writes governed by the same conflict/versioning model (#6), external semantics absorbed by the connector mapping layer so Core and modules stay industry-neutral (#7), and webhook-based triggers reusing the existing relay architecture (#5) rather than introducing new inbound exposure.

### Decision #9 — Calendar as the platform-wide appointment/event authority (LOCKED, 2026-08-12)

Resolves the open question carried since Decision #7 §2 ("exact Core-primitive vs. appointment-management-module feature boundary in practice").

Binding principles:

1. PULSE Calendar (a first-party module, per Decision #7) is the single authoritative domain for all appointments and calendar events created from this point forward, across every module and every client.
2. PULSE-Core's existing `appointments` table, service, and controller (the foundation-iteration proof of the Customer → AssistiveDevice → Case → Appointment chain) are frozen as legacy: no further fields, endpoints, or business logic may be added to them, and no new module or client-side flow may take a new dependency on them.
3. The legacy `appointments` table and its existing data are not deleted or migrated by this decision. Their controlled migration or removal is separate, explicitly-scoped future work — not an implicit side effect of Calendar shipping.
4. CRM, ERP, Cockpit, PULSEHuman, and any future module needing appointment/calendar functionality must integrate with Calendar exclusively through Calendar's own defined contracts and domain events (per Decision #7 §7's in-process service calls / internal event bus) — never by maintaining an independent, duplicate record of the same real-world appointment in their own schema, and never by directly querying Calendar's tables (Decision #7 §9).
5. A source module that wants an event of its own to appear in a user's calendar publishes it through Calendar's generic projection contract rather than Calendar special-casing that module by name — Calendar's own code does not change as new source modules (CRM, ERP, Cockpit, and beyond) are added later.
6. Every calendar event Calendar creates on another module's behalf carries a soft (non-foreign-key) origin reference back to that module and its entity, consistent with Decision #7 §10's prohibition on cross-schema foreign keys between Core and modules.
7. Authority for a given appointment is exactly one module at a time, generalizing Decision #8 §3's entity/group-level authority principle from external-system integration to inter-module integration within the same installation: whichever module owns the underlying business process (e.g. PULSEHuman for an approved absence) is authoritative for the resulting calendar data, and a direct edit attempted on the projected Calendar event is rejected rather than silently accepted or translated back.

This decision extends Decision #7's module-boundary philosophy (Core stays narrow; richer functionality lives in a module) to the specific case Decision #7 §2 left open, and extends Decision #8's single-source-of-truth-per-entity philosophy from external connectors to inter-module relationships within one installation. It does not reopen or modify Decisions #1–#8.

## Open decisions (must be resolved before implementation starts)

Decisions #1 (technology stack), #2 (database/tenancy model), #3 (API architecture), #4 (authentication and authorization), #5 (secure remote and mobile access), #6 (synchronization and offline strategy), #7 (module boundaries and extension architecture), #8 (integration layer) and #9 (Calendar as the platform-wide appointment/event authority) are locked above. The following remain explicitly undecided — flag them rather than assuming an answer:

- Concrete API versioning policy: supported-version and deprecation windows, and URI versioning vs. header versioning (see Decision #3)
- Structural separation and governance of internal vs. external/public APIs (see Decision #3, principle 9)
- Final SSE/WebSocket behavior under realistic customer network/reverse-proxy conditions (see Decision #3)
- Concrete relay control-plane design: installation registration/enrollment, hostname/routing assignment, and revocation of an installation's relay access
- Concrete mTLS/device-certificate enrollment mechanism and how it ties into Decision #4's per-device session model
- Tracking ECH (Encrypted Client Hello) adoption across target client platforms as a future hardening option for hiding relay-visible SNI metadata
- Concrete default role/permission catalog for PULSE-Core (see Decision #4, principle 4) — not designed yet
- OIDC user provisioning strategy (just-in-time provisioning on first SSO login vs. administrator pre-creates and links users) (see Decision #4, principle 1)
- Admin bootstrap process during installation (how the first administrator account(s) are created) (see Decision #4, principle 5)
- Concrete infrastructure-level emergency recovery tooling design (see Decision #4, principle 9)
- Governance process for extending the offline-write-queue allowlist as new data types/modules are added (see Decision #6, principle 3)
- Concrete staleness-indication thresholds/UX (e.g. when cached data is flagged stale) and the definition of "extended offline period" that triggers a mandatory refresh (see Decision #6, principles 8 and the additional binding rules)
- Fleet update/version management approach across many independent installations, and the split of backup responsibility/tooling between PULSE and the customer, including Node.js runtime management (see Decision #1, Follow-up #2)
- Desktop shell validation: Tauri vs. Electron, pending the WebView2 compatibility spike (see Decision #1, Follow-up #1)
- Whether/how a single customer installation supports multiple internal organizations/departments of that one customer (distinct from — and not to be confused with — cross-customer multi-tenancy, which is now excluded)
- Module SDK version-compatibility mechanics for independently distributed/updated modules (see Decision #7, principle 14)
- Whether/when to move from compile-time-registered modules to dynamically loadable plugins (see Decision #7)
- Concrete isolation technology for third-party modules and untrusted connectors (separate process, container, etc.) (see Decision #7, principle 13; Decision #8, principle 16)
- Design of any future central PULSE service (distribution/licensing/updates/module activation) so it structurally cannot hold operational data
- Concrete webhook-via-relay routing mechanics for inbound connector triggers (depends on the relay control-plane design above) (see Decision #8, principle 13)
- Concrete circuit-breaker/backoff parameters for connector failure isolation (see Decision #8, principle 15)
- Connector packaging/distribution format (bundled with Core initially vs. separately distributed later) (see Decision #8, principle 18)
- Which connectors ship first-party at launch (product/roadmap decision, not architecture)
- UI/UX for per-entity/group source-of-truth configuration and conflict resolution (see Decision #8, principles 3 and 9)
- Apple Calendar's technical feasibility for server-side sync specifically, pending a dedicated technical spike (see Decision #8, principle 23)

## Commands

The pnpm + Turborepo monorepo scaffold from Decision #1 is in place (first
implementation iteration: PULSE-Core foundation only — see README.md for
full setup instructions and prerequisites).

```sh
pnpm install                                    # install all workspace dependencies
docker compose up -d                            # local Postgres for development
pnpm migrate                                    # apply DB migrations (apps/api/drizzle/*.sql)
pnpm seed                                       # dev-only seed data (refuses NODE_ENV=production)
pnpm dev                                        # run apps/api + apps/dev-console together
pnpm build                                      # build all packages/apps
pnpm lint                                       # eslint across the monorepo
pnpm typecheck                                  # tsc --noEmit across the monorepo
pnpm test                                       # unit tests across the monorepo
pnpm --filter @pulse/api migrate:generate       # generate a new SQL migration after a schema change
```

apps/api serves the OpenAPI document (the canonical API contract per
Decision #3) at `http://localhost:3000/api/docs`.
