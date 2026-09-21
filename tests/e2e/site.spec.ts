import { test, expect, type Page } from "@playwright/test";
import { siteBaseURL, siteURL } from "./site-url";

/** The floating bar is 72px tall and sits 16px from the top of the viewport. */
const NAV_FLOOR = 60;

/** Anchors glide, so nothing is measured until the page has stopped moving. */
async function scrollSettled(page: Page) {
  let previous = -1;
  for (let i = 0; i < 40; i += 1) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === previous) return;
    previous = y;
    await page.waitForTimeout(50);
  }
}

/**
 * A section that has been navigated to has to be readable where it lands.
 *
 * Asserting that the heading is merely in the viewport cannot catch the bug
 * this exists for: a heading sitting under the fixed bar is still "in the
 * viewport" by every definition Playwright has. So the box is measured, and the
 * top edge has to clear the bar and stay inside the top 60% of the screen,
 * which is the band a reader actually arrives in.
 */
async function expectHeadingLandsBelowNav(page: Page, group: string) {
  const heading = page.locator(`${group} :is(h1, h2, h3)`).first();
  await expect(heading).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport, "the project must define a viewport size").not.toBeNull();
  const floor = viewport!.height * 0.6;
  await scrollSettled(page);
  await expect
    .poll(
      async () => {
        const box = await heading.boundingBox();
        if (!box) return "the heading has no box";
        if (box.y <= NAV_FLOOR)
          return `hidden under the navigation at ${Math.round(box.y)}px`;
        if (box.y >= floor)
          return `below the reading band at ${Math.round(box.y)}px`;
        return "in the reading band";
      },
      { message: `${group} heading position after navigating to it` },
    )
    .toBe("in the reading band");
}

/**
 * The site is one page plus the documentation, so `/pool` and `/underwriting`
 * are no longer routes: they are sections of the home page, reached at
 * `/#pool` and `/#underwriting`. Every assertion the suite made about them is
 * kept, just aimed at the section instead of the route.
 */
const routes = [
  "/",
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
    const response = await page.goto(siteURL(route));
    expect(response?.status()).toBe(200);
    const heading = await page.locator("h1").innerText();
    const refreshed = await page.reload();
    expect(refreshed?.status()).toBe(200);
    await expect(page).toHaveURL(siteURL(route));
    await expect(page.locator("h1")).toHaveText(heading, {
      useInnerText: true,
    });
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
        expect(href.startsWith(new URL(siteBaseURL).pathname), href).toBe(true);
        // An in-page link is rendered as `/suitor-protocol/#pool`, so the part
        // before the hash is the page that has to answer.
        const result = await request.get(href.split("#")[0]);
        expect(result.status(), href).toBe(200);
      }
    }
    const assets = await page
      .locator('script[src], link[rel="stylesheet"], link[rel="icon"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute("src") ?? node.getAttribute("href")!)
          .filter(Boolean),
      );
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      const url = new URL(asset, page.url());
      expect(
        url.pathname.startsWith(new URL(siteBaseURL).pathname),
        asset,
      ).toBe(true);
      expect((await request.get(url.href)).status(), asset).toBe(200);
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
  const home = siteURL("/");
  const mobile = testInfo.project.name === "mobile";
  await page.goto(home);
  await expect(
    page.getByRole("heading", { name: "Litigation funding on Solana." }),
  ).toBeVisible();

  const whitepaper = page.getByRole("link", { name: "Read the whitepaper" });
  await expect(whitepaper).toHaveCount(1);
  await whitepaper.click();
  await expect(page).toHaveURL(siteURL("/docs/whitepaper"));
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  const mainNav = page.getByRole("navigation", { name: "Main navigation" });
  if (mobile) await page.getByRole("button", { name: "Menu" }).click();
  await mainNav.getByRole("link", { name: "Underwriting" }).click();
  await expect(page).toHaveURL(`${home}#underwriting`);
  await expect(
    page.getByRole("heading", {
      name: "Every allocation starts with a review.",
    }),
  ).toBeInViewport();
  await expectHeadingLandsBelowNav(page, "#underwriting");

  if (mobile) await page.getByRole("button", { name: "Menu" }).click();
  await mainNav.getByRole("link", { name: "Outcomes" }).click();
  await expect(page).toHaveURL(/#outcomes$/);
  await expectHeadingLandsBelowNav(page, "#outcomes");

  // Separately: the engine preview further down the same group is reachable
  // and rendered, whatever the anchor did.
  const methodology = page.getByText("Methodology preview", { exact: true });
  await methodology.scrollIntoViewIfNeeded();
  await expect(methodology).toBeVisible();

  await page
    .getByRole("link", { name: "Suitor Protocol", exact: true })
    .click();
  await expect(page).toHaveURL(home);
});

test("documentation navigation is usable on mobile and desktop", async ({
  page,
}, testInfo) => {
  await page.goto(siteURL("/docs"));
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
  await expect(
    page.locator('#docs-navigation a[aria-current="page"]'),
  ).toHaveAttribute("href", new URL(siteURL("/docs/pool-shares")).pathname);
  if (testInfo.project.name === "mobile")
    await expect(
      page.getByRole("button", { name: "Documentation", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
});

test("deposit validates, reviews, edits, and completes without making a transaction", async ({
  page,
}, testInfo) => {
  await page.goto(siteURL("/"));
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") submissions.push(request.url());
  });
  const depositButton = page.getByRole("button", { name: "Preview deposit" });
  await expect(depositButton).toHaveCount(1);
  await depositButton.click();
  const dialog = page.getByRole("dialog");
  // The terminal's own inline quote field is labelled "Quote amount", so this
  // label belongs to the dialog alone.
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
  // Nothing outside the dialog owns a live region, so this is unambiguous.
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
    page
      .locator(".metrics > div")
      .filter({ hasText: "Total deposits" })
      .getByRole("definition"),
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
  await page.goto(siteURL("/"));
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
  for (const route of ["/", "/docs", "/docs/whitepaper"]) {
    await page.goto(siteURL(route));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(siteURL("/docs/whitepaper"));
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("unknown pages have a useful 404", async ({ page }) => {
  const response = await page.goto(siteURL("/docs/does-not-exist"));
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page isn’t here." }),
  ).toBeVisible();
});
