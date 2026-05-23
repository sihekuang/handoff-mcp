import { test, expect } from "@playwright/test";

test("list page shows handoffs heading and the seeded handoff", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Handoffs", level: 1 })).toBeVisible();
  // The handoff created by Agent A should be present.
  await expect(page.getByRole("link", { name: /Refactor session token storage/ })).toBeVisible();
});

test("detail page renders body and git metadata", async ({ page }) => {
  await page.goto("/h/h_9i5autiljl");
  await expect(page.getByRole("heading", { name: "Refactor session token storage" })).toBeVisible();
  // Body content contains "Sketched a TypedSessionStore interface"
  await expect(page.locator("article").getByText(/Sketched a TypedSessionStore interface/)).toBeVisible();
  // Git metadata is rendered in sidebar
  await expect(page.getByText("feat/session-typed")).toBeVisible();
});
