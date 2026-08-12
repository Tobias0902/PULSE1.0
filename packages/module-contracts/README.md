# @pulse/module-contracts

**Pre-1.0, unstable.** This is the seed of the eventual versioned Module SDK
described in CLAUDE.md Decision #7 — plain TypeScript contracts a module
descriptor and (later) the internal event bus are built against. It is not
the Module SDK itself: it has no compatibility negotiation, no isolation
boundary for untrusted modules, and its shape is expected to change as real
modules (CRM, QM, AI, ...) are added. Do not treat anything exported here as
a stable public API.
