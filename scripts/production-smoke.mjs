/**
 * Post-deploy smoke test. Read-only: it never submits a lead or touches
 * operator data, so it is safe to run against production on every release.
 *
 *   node scripts/production-smoke.mjs https://app.example.com
 *
 * Exits non-zero on the first failed check so a deploy pipeline can gate on it.
 */
const baseUrl = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("Usage: node scripts/production-smoke.mjs <base-url>");
  process.exit(2);
}

const results = [];

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function get(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...options });
}

await check("home page serves", async () => {
  const response = await get("/");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const body = await response.text();
  assert(body.includes("Request a quote"), "the public call to action is missing");
});

await check("public quote request form serves", async () => {
  const response = await get("/quote-request");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const body = await response.text();
  // Assert on the field names, not on label text: React splits adjacent text
  // nodes with comment markers, so rendered copy is not a contiguous substring.
  assert(body.includes('name="originLine1"'), "the origin address fields are missing");
  assert(body.includes('name="destinationLine1"'), "the destination address fields are missing");
});

await check("sign-in page serves", async () => {
  const response = await get("/login");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const body = await response.text();
  assert(body.includes("Sign in"), "the sign-in control is missing");
});

await check("admin is closed to anonymous visitors", async () => {
  const response = await get("/admin/leads");
  assert(
    response.status === 307 || response.status === 302,
    `expected a redirect, got ${response.status}`
  );
  const location = response.headers.get("location") ?? "";
  assert(location.includes("/login"), `expected a redirect to /login, got ${location}`);
});

await check("security headers are present", async () => {
  const response = await get("/");
  const expected = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin"
  };

  for (const [header, value] of Object.entries(expected)) {
    const actual = response.headers.get(header);
    assert(actual === value, `${header}: expected ${value}, got ${actual ?? "nothing"}`);
  }

  assert(
    response.headers.get("x-powered-by") === null,
    "x-powered-by should not advertise the framework"
  );
});

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl);

if (isLocal) {
  // Running against a local server: transport checks do not apply.
  results.push({ name: "the deployment is served over HTTPS", ok: true, skipped: true });
} else {
  await check("the deployment is served over HTTPS", async () => {
    assert(baseUrl.startsWith("https://"), "the base URL is not HTTPS");
    const response = await get("/");
    assert(
      (response.headers.get("strict-transport-security") ?? "").includes("max-age="),
      "HSTS is not set"
    );
  });
}

const failed = results.filter((result) => !result.ok);

for (const result of results) {
  const status = result.skipped ? "SKIP" : result.ok ? "PASS" : "FAIL";
  console.log(`${status}  ${result.name}${result.ok ? "" : ` — ${result.detail}`}`);
}

console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${baseUrl}`);
process.exit(failed.length === 0 ? 0 : 1);
