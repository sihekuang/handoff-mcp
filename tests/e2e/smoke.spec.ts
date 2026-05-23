// tests/e2e/smoke.spec.ts
import { test, expect, type APIRequestContext } from "@playwright/test";

let createdId: string;

test.beforeAll(async ({ request }) => {
  const res = await request.post("http://localhost:3000/api/handoffs", {
    data: {
      title: "E2E smoke handoff",
      body: "## What was done\n- Set up e2e\n## What's left\n- write more tests",
      tags: ["smoke"],
      metadata: { git: { branch: "smoke-branch" } },
    },
  });
  expect(res.status()).toBe(201);
  const json = await res.json();
  createdId = json.id;
});

test("list page renders the seeded handoff", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Handoffs", level: 1 })).toBeVisible();
  // Pin to the specific handoff created in beforeAll by its unique href.
  await expect(page.locator(`a[href="/h/${createdId}"]`)).toBeVisible();
});

test("detail page renders the body and git metadata", async ({ page }) => {
  await page.goto(`/h/${createdId}`);
  await expect(page.getByRole("heading", { name: "E2E smoke handoff" })).toBeVisible();
  await expect(page.getByText(/write more tests/)).toBeVisible();
  await expect(page.getByText(/smoke-branch/)).toBeVisible();
});
