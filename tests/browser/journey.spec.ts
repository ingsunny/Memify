import { test, expect } from "@playwright/test";
test("explore, sign up, create and review a deck, quiz, persist, export and sign out", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A good day to grow." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-today.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Start your learning journey" })
    .click();
  await page.getByLabel("What should we call you?").fill("Sunny");
  await page
    .getByLabel("Email address")
    .fill(`${testInfo.project.name}-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("memify-test-password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("What are you curious about?").fill("Biology");
  await page.getByRole("button", { name: "Let’s get learning" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day to grow, Sunny." }),
  ).toBeVisible();
  await page.goto("/library");
  await page.getByRole("button", { name: "Create a deck" }).click();
  await page.getByLabel("Deck name").fill("My biology notes");
  await page.getByLabel("Front · question").fill("What is a cell?");
  await page.getByLabel("Back · answer").fill("The basic unit of life.");
  await page.getByRole("button", { name: "Save deck", exact: true }).click();
  await page.getByRole("link").filter({ hasText: "My biology notes" }).click();
  await page.getByRole("link", { name: "Review 1 cards" }).click();
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(
    page.getByText("The basic unit of life.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(
    page.getByRole("heading", { name: "Look at you, growing." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "A good place to pause" }).click();
  await page.getByRole("link", { name: "Try a recall quiz" }).click();
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("A basic unit of life");
  await page.getByRole("button", { name: "Compare your answer" }).click();
  await page.getByRole("button", { name: "Got the idea" }).click();
  await page.goto("/progress");
  await expect(
    page.getByText("reviews completed", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Your name")).toHaveValue("Sunny");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "memify-export.json",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A workspace that feels like you." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("collection previews and generation stay honest without an account", async ({
  page,
}) => {
  await page.goto("/discover/design");
  await page.getByRole("link", { name: "Try these cards" }).click();
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(
    page.getByText(
      "Arranging elements so their size, contrast, and position communicate their relative importance.",
    ),
  ).toBeVisible();
  await page.goto("/generate");
  await expect(
    page.getByText("generations, on us.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("key pages pass automated accessibility checks", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const path of ["/", "/discover", "/generate"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect
      .soft(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      )
      .toEqual([]);
  }
});
