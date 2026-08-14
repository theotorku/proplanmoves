import { expect, test } from "@playwright/test";

test("renders the public application shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /local move operations/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a quote" })).toHaveAttribute(
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
});
