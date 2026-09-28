import { expect, test } from "@playwright/test";

test("renders the public application shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /a little planning. a better move./i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a quote" }).first()).toHaveAttribute(
    "href",
    "/quote-request"
  );
});

test("shows validation feedback for an incomplete quote request", async ({ page }) => {
  await page.goto("/quote-request", { waitUntil: "domcontentloaded" });
  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Last name").fill("Rivera");
  await page.getByLabel("Origin street address").fill("100 Main St");
  await page.getByLabel("Origin city").fill("Chicago");
  await page.getByLabel("Origin state").fill("IL");
  await page.getByLabel("Origin postal code").fill("60601");
  await page.getByLabel("Destination street address").fill("200 Lake St");
  await page.getByLabel("Destination city").fill("Evanston");
  await page.getByLabel("Destination state").fill("IL");
  await page.getByLabel("Destination postal code").fill("60201");
  await page.getByRole("button", { name: "Request a quote" }).click();

  await expect(page.getByText("Please correct the highlighted fields.")).toBeVisible();
  await expect(page.getByText("Provide either an email address or phone number.")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Jordan");
  await expect(page.getByLabel("Origin street address")).toHaveValue("100 Main St");
  await expect(page.getByRole("form", { name: "Request a moving quote" }).getByRole("alert")).toBeFocused();
});

test("service selection carries into the quote request and rejects unknown presets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^Packing help/ }).click();
  await expect(page.getByLabel("Move type")).toHaveValue("packing_service");
  await page.goto("/quote-request?service=unsupported");
  await expect(page.getByLabel("Move type")).toHaveValue("residential");
});

test("mobile landing navigation, FAQ, and form fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Service areas" }).click();
  await expect(page.getByRole("heading", { name: /Across the Metroplex/ })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Does requesting a quote book my move?" }).click();
  await expect(page.getByText("No. Your request starts the conversation.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Request a quote" }).first().click();
  await expect(page.getByLabel("First name")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
