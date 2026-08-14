import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { OPERATOR_EMAIL, OPERATOR_PASSWORD } from "./global-setup";

/**
 * Serious and critical WCAG failures are treated as build failures. Moderate
 * findings are left to design review rather than blocking a release.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
}

function describeViolations(violations: Awaited<ReturnType<typeof scan>>) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(" "))
          .join("\n  ")}`
    )
    .join("\n");
}

test("public pages meet WCAG AA on serious and critical rules", async ({ page }) => {
  for (const path of ["/", "/quote-request", "/login"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const violations = await scan(page);
    expect(describeViolations(violations), `violations on ${path}`).toBe("");
  }
});

test("admin pages meet WCAG AA on serious and critical rules", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(OPERATOR_EMAIL);
  await page.getByLabel("Password").fill(OPERATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();

  for (const path of ["/admin/dashboard", "/admin/leads", "/admin/jobs"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const violations = await scan(page);
    expect(describeViolations(violations), `violations on ${path}`).toBe("");
  }
});
