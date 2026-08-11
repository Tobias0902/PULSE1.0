# PULSE dev console

**This is a throwaway development/admin shell, not the future PULSE Cockpit UI.**

It exists only to prove, visually, that the PULSE-Core domain hierarchy
(`Customer -> AssistiveDevice -> Case -> Appointment`) works end to end and
that every Appointment is traceable back to its Case, AssistiveDevice and
Customer. No design system, routing, or state-management choice made here
should be read as a decision about the real Cockpit UX — that is explicitly
out of scope for this iteration (see the root CLAUDE.md).

Run with the API already running (see the root README):

```sh
pnpm --filter @pulse/dev-console dev
```
