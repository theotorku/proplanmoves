import { expect, test, type Page } from "@playwright/test";
import { OPERATOR_EMAIL, OPERATOR_PASSWORD } from "./global-setup";

/**
 * The mandatory happy path from TESTING.md, walked through the real UI:
 * public request → qualify → estimate → approve → quote → accept → job →
 * schedule → dashboard.
 */
test("a public request becomes a scheduled job", async ({ page }) => {
  const reference = await submitPublicQuoteRequest(page);

  await signIn(page);
  await openLead(page, reference);

  await qualifyLead(page);
  await generateAndApproveEstimate(page);
  const quoteUrl = await createQuote(page);

  await acceptQuote(page, quoteUrl);
  await bookJob(page);
  const jobUrl = page.url();

  await scheduleJob(page, jobUrl);
  await expectDashboardReflectsTheJob(page);
});

async function submitPublicQuoteRequest(page: Page): Promise<string> {
  await page.goto("/quote-request", { waitUntil: "domcontentloaded" });

  const stamp = Date.now();
  await page.locator('input[name="firstName"]').fill("Wilhelmina");
  await page.locator('input[name="lastName"]').fill("Okonkwo");
  await page.locator('input[name="email"]').fill(`e2e-customer-${stamp}@example.com`);
  await page.locator('select[name="moveType"]').selectOption("residential");
  await page.locator('input[name="bedroomCount"]').fill("2");
  await page.getByLabel("Origin street address").fill("100 Main St");
  await page.getByLabel("Origin city").fill("Chicago");
  await page.getByLabel("Origin state").fill("IL");
  await page.getByLabel("Origin postal code").fill("60601");
  await page.getByLabel("Destination street address").fill("200 Lake St");
  await page.getByLabel("Destination city").fill("Evanston");
  await page.getByLabel("Destination state").fill("IL");
  await page.getByLabel("Destination postal code").fill("60201");

  await page.getByRole("button", { name: "Request a quote" }).click();

  const confirmation = page.getByText(/Your confirmation reference is/i);
  await expect(confirmation).toBeVisible();

  const reference = await page.locator("span.font-mono").first().innerText();
  expect(reference).toMatch(/^LEAD-\d{4}-\d{5}$/);
  return reference;
}

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(OPERATOR_EMAIL);
  await page.getByLabel("Password").fill(OPERATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
}

async function openLead(page: Page, reference: string) {
  await page.goto(`/admin/leads?search=${reference}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { name: reference })).toBeVisible();
}

async function qualifyLead(page: Page) {
  await page.locator('select[name="status"]').selectOption("qualified");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Lead status updated.")).toBeVisible();
}

async function generateAndApproveEstimate(page: Page) {
  await page.getByRole("button", { name: "Generate estimate" }).click();
  await expect(page.getByText(/Estimate EST-\d{4}-\d{5} generated\./)).toBeVisible();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Estimate moved to under review.")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Estimate moved to approved.")).toBeVisible();
}

async function createQuote(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Create quote" }).click();

  // The create form is replaced by the quote it created, so the quote itself is
  // the confirmation rather than the action message.
  const quoteLink = page.getByRole("link", { name: /^QUO-\d{4}-\d{5}$/ });
  await expect(quoteLink).toBeVisible();
  await quoteLink.click();
  await expect(page.getByRole("heading", { name: /^QUO-\d{4}-\d{5}$/ })).toBeVisible();
  return page.url();
}

async function acceptQuote(page: Page, quoteUrl: string) {
  await page.goto(quoteUrl, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Quote moved to ready.")).toBeVisible();

  await page.getByRole("button", { name: "Mark sent" }).click();
  await expect(page.getByText("Quote moved to sent.")).toBeVisible();

  await page.getByRole("button", { name: "Record acceptance" }).click();
  await expect(page.getByText("Quote moved to accepted.")).toBeVisible();
}

async function bookJob(page: Page) {
  await page.getByRole("button", { name: "Book the job" }).click();

  const jobLink = page.getByRole("link", { name: /^JOB-\d{4}-\d{5}$/ });
  await expect(jobLink).toBeVisible();
  await jobLink.click();
  await expect(page.getByRole("heading", { name: /^JOB-\d{4}-\d{5}$/ })).toBeVisible();
}

async function scheduleJob(page: Page, jobUrl: string) {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded" });

  const moveDate = new Date();
  moveDate.setDate(moveDate.getDate() + 10);
  const isoDate = moveDate.toISOString().slice(0, 10);

  await page.locator('input[name="scheduledDate"]').fill(isoDate);
  await page.locator('input[name="arrivalWindowStart"]').fill("08:00");
  await page.locator('input[name="arrivalWindowEnd"]').fill("10:00");
  await page.getByRole("button", { name: /Schedule job|Update schedule/ }).click();

  await expect(page.getByText("Schedule updated.")).toBeVisible();
  await expect(page.getByText(isoDate)).toBeVisible();
}

async function expectDashboardReflectsTheJob(page: Page) {
  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Upcoming jobs" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Upcoming jobs" }).getByRole("link", {
      name: /^JOB-\d{4}-\d{5}$/
    })
  ).toBeVisible();

  await expect(page.getByText("Booked revenue")).toBeVisible();
}
