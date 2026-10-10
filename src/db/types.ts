import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

// Works with postgres-js in production and PGlite in tests.
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
