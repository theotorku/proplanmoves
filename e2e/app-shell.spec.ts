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
  await page.locator('input[name="originLine1"]').fill("100 Main St");
  await page.locator('input[name="originCity"]').fill("Chicago");
  await page.locator('input[name="originState"]').fill("IL");
  await page.locator('input[name="originPostalCode"]').fill("60601");
  await page.locator('input[name="destinationLine1"]').fill("200 Lake St");
  await page.locator('input[name="destinationCity"]').fill("Evanston");
  await page.locator('input[name="destinationState"]').fill("IL");
  await page.locator('input[name="destinationPostalCode"]').fill("60201");
  await page.getByRole("button", { name: "Request a quote" }).click();

  await expect(page.getByText("Please correct the highlighted fields.")).toBeVisible();
  await expect(page.getByText("Provide either an email address or phone number.")).toBeVisible();
});
