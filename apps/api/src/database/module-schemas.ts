import * as coreSchema from "./schema";
import * as calendarSchema from "../modules/calendar/database/calendar.schema";

// Combined schema object passed to drizzle() so db.query.<table> works
// uniformly across Core and every registered module, exactly like
// module-descriptors.ts aggregates runtime module metadata. Modules stay
// compile-time NestJS imports (CLAUDE.md Decision #7 §12), so this file
// necessarily lists each module's schema by name — a bootstrap/wiring
// concern, not the "Core hardcodes module business logic" Decision #7 §8
// warns against (see the same note on module-descriptors.ts).
//
// Table names must stay unique across every module's schema object: a
// name collision here would silently shadow one module's table with
// another's in db.query.* (plain db.insert/update/select are unaffected,
// since they reference the table object directly rather than this bag).
export const combinedSchema = {
  ...coreSchema,
  ...calendarSchema,
};
