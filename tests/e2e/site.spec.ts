import { test, expect } from "@playwright/test";

const routes = [
  "/",
  "/underwriting",
  "/pool",
  "/docs",
  "/docs/whitepaper",
  "/docs/pool-shares",
  "/docs/underwriting-methodology",
  "/docs/outcome-estimates",
  "/docs/risks",
];

for (const route of routes) {
  test(`renders ${route} with working links and no page overflow`, async ({
    page,
    request,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(
      `© ${new Date().getFullYear()} Suitor Protocol. All rights reserved.`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(await page.locator("body").innerText()).not.toContain("—");
    const links = await page
      .locator("a[href]")
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((node) => node.getAttribute("href")!)),
      ]);
    for (const href of links) {
      if (href.startsWith("#")) await expect(page.locator(href)).toHaveCount(1);
      else if (href.startsWith("/")) {
        const result = await request.get(href.split("#")[0]);
        expect(result.status(), href).toBe(200);
      }
    }
    await page.screenshot({
      path: testInfo.outputPath("page.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("primary navigation, wordmark, and whitepaper action work", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Litigation funding on Solana." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Read the whitepaper" }).click();
  await expect(page).toHaveURL(/\/docs\/whitepaper$/);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Underwriting" })
    .click();
  await expect(page).toHaveURL(/\/underwriting$/);
  await page.getByRole("link", { name: "02 Outcome engine" }).click();
  await expect(page).toHaveURL(/#outcomes$/);
  await expect(
    page.getByText("Methodology preview", { exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("link", { name: "Suitor Protocol", exact: true })
    .click();
  await expect(page).toHaveURL("/");
});

test("documentation navigation is usable on mobile and desktop", async ({
  page,
}, testInfo) => {
  await page.goto("/docs");
  if (testInfo.project.name === "mobile") {
    await expect(
      page.getByRole("navigation", { name: "Documentation", exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "Documentation", exact: true })
      .click();
  }
  await page
    .getByRole("navigation", { name: "Documentation", exact: true })
    .getByRole("link", { name: "03 Pool shares" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Understanding pool shares." }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile")
    await expect(
      page.getByRole("button", { name: "Documentation", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
});

test("deposit validates, reviews, edits, and completes without making a transaction", async ({
  page,
}, testInfo) => {
  await page.goto("/pool");
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") submissions.push(request.url());
  });
  const depositButton = page.getByRole("button", { name: "Preview deposit" });
  await depositButton.click();
  const dialog = page.getByRole("dialog");
  const input = page.getByLabel("Amount in test dollars");
  await expect(dialog).toContainText("This is a simulation.");
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Review share allocation" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter an amount");
  for (const value of ["-10", "1.001", "1000000.01", "0", "1e3"]) {
    await input.fill(value);
    await page.getByRole("button", { name: "Review share allocation" }).click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("alert")).toBeVisible();
  }
  await input.fill("1000");
  await input.press("Enter");
  await expect(
    dialog.getByRole("heading", { name: "Review the illustration." }),
  ).toBeFocused();
  await expect(dialog).toContainText("0.0999%");
  await page.getByRole("button", { name: "Back to amount" }).click();
  await expect(input).toHaveValue("1000");
  await input.fill("2500.25");
  await input.press("Enter");
  await expect(dialog).toContainText("$2,500.25");
  await expect(dialog).toContainText("2,500.25");
  await page.screenshot({
    path: testInfo.outputPath("deposit-review.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Complete simulated deposit" })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Deposit simulated." }),
  ).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "Your deposit was simulated.",
  );
  await expect(dialog).toContainText("No funds moved");
  await page.screenshot({
    path: testInfo.outputPath("deposit-confirmation.png"),
    fullPage: true,
  });
  expect(submissions).toEqual([]);
  await page.getByRole("button", { name: "Return to the pool" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(depositButton).toBeFocused();
  await expect(
    page.locator(".metrics > div").filter({ hasText: "Total deposits" }).getByRole("definition"),
  ).toContainText("$1,000,000");
  await depositButton.click();
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(depositButton).toBeFocused();
});

test("dialog keeps keyboard focus inside and supports cancellation", async ({
  page,
}) => {
  await page.goto("/pool");
  await page.getByRole("button", { name: "Preview deposit" }).click();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Close deposit preview" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("narrow screens and enlarged text do not overflow the reading layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of ["/", "/pool", "/underwriting", "/docs/whitepaper"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/whitepaper");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("unknown pages have a useful 404", async ({ page }) => {
  const response = await page.goto("/docs/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page isn’t here." }),
  ).toBeVisible();
});
