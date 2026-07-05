// Import FIRST in any CLI test file that does not need the database.
// Sets HANDOFF_NO_DB before tests/setup.ts's beforeAll runs (so it skips the
// Postgres testcontainer) and clears it afterAll so the flag never leaks into
// DB-dependent test files that run later in the same process.
import { afterAll } from "vitest";

process.env.HANDOFF_NO_DB = "1";
afterAll(() => {
  delete process.env.HANDOFF_NO_DB;
});
