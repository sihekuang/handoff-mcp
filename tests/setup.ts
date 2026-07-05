// One Postgres container per test process (forks pool, singleFork=true).
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll } from "vitest";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  if (process.env.HANDOFF_NO_DB) return;
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("handoff_test")
    .withUsername("test")
    .withPassword("test")
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
});

afterAll(async () => {
  if (process.env.HANDOFF_NO_DB) return;
  await container?.stop();
});
