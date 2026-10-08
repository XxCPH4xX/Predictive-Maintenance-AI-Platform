import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const screenshots = path.resolve("../reports/screenshots");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await fs.mkdir(screenshots, { recursive: true });
});

test("single prediction and persisted machine detail", async ({ page }) => {
  await page.goto("/prediction");
  await page.getByLabel(/Machine identifier/).fill("BROWSER-001");
  await page.getByRole("button", { name: "Run prediction" }).click();
  await expect(
    page.getByRole("heading", { name: "Prediction result", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("What influenced this prediction?"),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, "prediction.png"),
    fullPage: true,
  });
  await page.goto("/machines/BROWSER-001");
  await expect(
    page.getByRole("heading", { name: "Sensor snapshot", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recent observations", { exact: true }),
  ).toBeVisible();
});

test("batch returns invalid rows and exports their errors", async ({
  page,
}) => {
  await page.goto("/batch");
  const csv =
    "machine_id,machine_type,air_temperature,process_temperature,rotational_speed,torque,tool_wear\nBATCH-001,M,298.1,308.6,1551,42.8,0\nBATCH-BAD,X,298,310,1500,40,0\n";
  await page.getByLabel("CSV file").setInputFiles({
    name: "readings.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Analyze CSV" }).click();
  await expect(
    page.getByText("Records requiring correction", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/machine_type: Input should be/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download results" }).click();
  const file = await downloaded;
  const output = await fs.readFile((await file.path())!, "utf8");
  expect(output).toContain("BATCH-001");
  expect(output).toContain("machine_type");
});

test("what-if runs real inference without recording history", async ({
  page,
  request,
}) => {
  const before = (await (await request.get("/api/predictions")).json()).total;
  await page.goto("/scenario");
  await page.getByRole("button", { name: "Start scenario analysis" }).click();
  await expect(
    page.getByText("Adjust scenario readings", { exact: true }),
  ).toBeVisible();
  const predicted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/predict") &&
      response.request().postDataJSON()?.torque === 80,
  );
  await page.locator("#scenario-torque").press("End");
  expect((await predicted).status()).toBe(200);
  expect((await (await request.get("/api/predictions")).json()).total).toBe(
    before,
  );
});

test("simulation feeds real predictions and fleet updates", async ({
  page,
}) => {
  await page.goto("/simulation");
  await page.getByRole("button", { name: "Run one interval" }).click();
  await expect(
    page.getByRole("link", { name: "SIM-001", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "SIM-001", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Fleet condition", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recharts-sector").first()).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, "overview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(screenshots, "mobile-overview.png"),
    fullPage: true,
  });
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBeTruthy();
});

test("performance displays measured metrics and every route loads", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/performance");
  const metrics = await (await request.get("/api/model/performance")).json();
  const recall = `${(metrics.final.metrics.recall * 100).toFixed(1)}%`;
  await expect(page.getByText(recall, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("Experimental failure-type evaluation", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recharts-line-curve").first()).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, "performance.png"),
    fullPage: true,
  });
  for (const route of ["/machines", "/history"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
