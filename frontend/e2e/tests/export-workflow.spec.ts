import path from "path";
import { fileURLToPath } from "url";
import { test, expect, type Page } from "@playwright/test";
import { TestRole, getCredentials, loginViaUI, logoutViaUI } from "../fixtures/auth";

const uniqueSuffix = () => Date.now().toString(36);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

// ─── Helper: Wait for success toast ─────────────────────────────────────────
async function waitForSuccessToast(page: Page, timeout = 10000) {
  await expect(
    page.locator('[data-sonner-toast][data-type="success"]'),
  ).toBeVisible({ timeout });
}

// ─── Helper: Navigate to export page and select a dataset ────────────────────
async function navigateAndSelectDataset(page: Page, datasetName: string) {
  await page.goto("/admin/export");
  await expect(page.getByTestId("export-page")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("export-dataset-select").click();
  await page.waitForTimeout(300);
  const option = page.locator('[role="option"]').filter({ hasText: datasetName });
  await option.click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("delivered-jobs-table")).toBeVisible({ timeout: 5000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Export & De-identification (Admin)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe("8. Export & De-identification (Admin)", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = uniqueSuffix();
  const datasetName = `E2E Export ${suffix}`;

  // State shared across all tests
  let deliveredJobIds: string[] = [];
  let sharedPage: Page;

  // ────────────────────────────────────────────────────────────────────────
  // Setup: Create DELIVERED jobs via full workflow
  // ────────────────────────────────────────────────────────────────────────
  test("Setup — Create delivered jobs via full workflow", async ({ browser }) => {
    test.setTimeout(120000);
    const context = await browser.newContext();
    const page = await context.newPage();

    // ── Step 0: Login as Admin, clean up old datasets ──
    const adminCreds = getCredentials(TestRole.ADMIN);
    await loginViaUI(page, adminCreds.email, adminCreds.password);
    await page.waitForURL("**/admin/dashboard");

    // Delete ALL datasets to clear content_hash dedup
    await page.evaluate(async () => {
      const res = await fetch("/api/datasets/?page_size=100", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const datasets = data.results || data;
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      for (const ds of datasets) {
        await fetch(`/api/datasets/${ds.id}/`, {
          method: "DELETE",
          credentials: "include",
          headers: { "X-CSRFToken": csrfToken },
        });
      }
    });
    await page.waitForTimeout(500);

    // ── Step 1: Upload dataset ──
    await page.goto("/admin/datasets");
    await page.waitForSelector('[data-testid="datasets-page"]');
    await page.getByTestId("upload-dataset-button").click();
    await page.waitForSelector('[data-testid="upload-dialog"]');
    await page.getByTestId("dataset-name-input").fill(datasetName);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, "sample-emails.zip"));
    await page.getByTestId("upload-submit").click();
    await expect(page.getByText("Upload Complete")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(500);

    // ── Step 2: Get dataset ID, job IDs, users, and assign to annotator ──
    const setupData = await page.evaluate(async (dsName) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const headers = { "Content-Type": "application/json", "X-CSRFToken": csrfToken };

      const dsRes = await fetch("/api/datasets/?page_size=100", { credentials: "include" });
      if (!dsRes.ok) return { error: `Datasets fetch failed: ${dsRes.status}` };
      const dsData = await dsRes.json();
      const datasets = dsData.results || dsData;
      const ds = datasets.find((d: { name: string }) => d.name === dsName);
      if (!ds) return { error: `Dataset '${dsName}' not found` };

      const jobsRes = await fetch(`/api/datasets/${ds.id}/jobs/?page_size=50`, { credentials: "include" });
      if (!jobsRes.ok) return { error: `Jobs fetch failed: ${jobsRes.status}` };
      const jobsData = await jobsRes.json();
      const jobs = jobsData.results || jobsData;
      const jobIds = jobs.map((j: { id: string }) => j.id);
      if (!jobIds.length) return { error: "No jobs found for dataset" };

      const usersRes = await fetch("/api/users/?page_size=50", { credentials: "include" });
      if (!usersRes.ok) return { error: `Users fetch failed: ${usersRes.status}` };
      const usersData = await usersRes.json();
      const users = usersData.results || usersData;
      const annotator = users.find((u: { role: string }) => u.role === "ANNOTATOR");
      const qa = users.find((u: { role: string }) => u.role === "QA");
      if (!annotator || !qa) return { error: "Annotator or QA user not found" };

      const classesRes = await fetch("/api/annotation-classes/?page_size=50", { credentials: "include" });
      if (!classesRes.ok) return { error: `Annotation classes fetch failed: ${classesRes.status}` };
      const classesData = await classesRes.json();
      const classes = classesData.results || classesData;
      if (!classes.length) return { error: "No annotation classes found" };

      const assignRes = await fetch("/api/jobs/assign/", {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ job_ids: jobIds, assignee_id: annotator.id, type: "ANNOTATION" }),
      });
      if (!assignRes.ok) {
        const text = await assignRes.text();
        return { error: `Assign annotator failed: ${assignRes.status} ${text}` };
      }

      return {
        datasetId: ds.id, jobIds,
        annotatorId: annotator.id, qaId: qa.id,
        firstClassId: classes[0].id, firstClassName: classes[0].name,
      };
    }, datasetName);

    if (!setupData || "error" in setupData) {
      throw new Error(`Setup failed: ${JSON.stringify(setupData)}`);
    }

    // ── Step 3: Login as Annotator, start + submit annotations ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    const annotatorCreds = getCredentials(TestRole.ANNOTATOR);
    await loginViaUI(page, annotatorCreds.email, annotatorCreds.password);
    await page.waitForURL("**/annotator/dashboard");

    const annotateResult = await page.evaluate(async ({ jobIds, firstClassId, firstClassName }) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const headers = { "Content-Type": "application/json", "X-CSRFToken": csrfToken };

      for (const jobId of jobIds) {
        const startRes = await fetch(`/api/annotations/jobs/${jobId}/start/`, {
          method: "POST", credentials: "include", headers,
        });
        if (!startRes.ok) return { error: `Start annotation failed for ${jobId}: ${startRes.status}` };

        const rawRes = await fetch(`/api/annotations/jobs/${jobId}/raw-content/`, { credentials: "include" });
        if (!rawRes.ok) return { error: `Get raw content failed for ${jobId}: ${rawRes.status}` };
        const rawData = await rawRes.json();
        const content = (rawData.raw_content as string || "").replace(/\r/g, "");
        const annotationText = content.substring(0, Math.min(20, content.length)).trim();
        if (!annotationText) return { error: `Empty content for ${jobId}` };

        const submitRes = await fetch(`/api/annotations/jobs/${jobId}/submit/`, {
          method: "POST", credentials: "include", headers,
          body: JSON.stringify({
            annotations: [{
              annotation_class: firstClassId,
              tag: `${firstClassName}_1`,
              start_offset: 0,
              end_offset: annotationText.length,
              original_text: annotationText,
            }],
          }),
        });
        if (!submitRes.ok) {
          const text = await submitRes.text();
          return { error: `Submit failed for ${jobId}: ${submitRes.status} ${text}` };
        }
      }
      return { success: true };
    }, { jobIds: setupData.jobIds, firstClassId: setupData.firstClassId, firstClassName: setupData.firstClassName });

    if (!annotateResult || "error" in annotateResult) {
      throw new Error(`Annotation setup failed: ${JSON.stringify(annotateResult)}`);
    }

    // ── Step 4: Login as Admin, assign to QA ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    await loginViaUI(page, adminCreds.email, adminCreds.password);
    await page.waitForURL("**/admin/dashboard");

    const assignQAResult = await page.evaluate(async ({ jobIds, qaId }) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/jobs/assign/", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
        body: JSON.stringify({ job_ids: jobIds, assignee_id: qaId, type: "QA" }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { error: `Assign QA failed: ${res.status} ${text}` };
      }
      return { success: true };
    }, { jobIds: setupData.jobIds, qaId: setupData.qaId });

    if (!assignQAResult || "error" in assignQAResult) {
      throw new Error(`QA assignment failed: ${JSON.stringify(assignQAResult)}`);
    }

    // ── Step 5: Login as QA, start + accept each job ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    const qaCreds = getCredentials(TestRole.QA);
    await loginViaUI(page, qaCreds.email, qaCreds.password);
    await page.waitForURL("**/qa/dashboard");

    const qaResult = await page.evaluate(async ({ jobIds }) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const headers = { "Content-Type": "application/json", "X-CSRFToken": csrfToken };

      for (const jobId of jobIds) {
        const startRes = await fetch(`/api/qa/jobs/${jobId}/start/`, {
          method: "POST", credentials: "include", headers,
        });
        if (!startRes.ok) {
          const text = await startRes.text();
          return { error: `Start QA failed for ${jobId}: ${startRes.status} ${text}` };
        }

        const acceptRes = await fetch(`/api/qa/jobs/${jobId}/accept/`, {
          method: "POST", credentials: "include", headers,
          body: JSON.stringify({ comments: "Looks good" }),
        });
        if (!acceptRes.ok) {
          const text = await acceptRes.text();
          return { error: `Accept QA failed for ${jobId}: ${acceptRes.status} ${text}` };
        }
      }
      return { success: true };
    }, { jobIds: setupData.jobIds });

    if (!qaResult || "error" in qaResult) {
      throw new Error(`QA setup failed: ${JSON.stringify(qaResult)}`);
    }

    deliveredJobIds = setupData.jobIds;
    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Shared admin page for all export tests (8.1 through 8.5)
  // ────────────────────────────────────────────────────────────────────────
  test("8.1.1 — Export page renders with dataset select and history table", async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    const creds = getCredentials(TestRole.ADMIN);
    await loginViaUI(sharedPage, creds.email, creds.password);
    await sharedPage.waitForURL("**/admin/dashboard");

    await sharedPage.goto("/admin/export");
    await expect(sharedPage.getByTestId("export-page")).toBeVisible({ timeout: 10000 });
    await expect(sharedPage.getByTestId("export-dataset-select")).toBeVisible();
    await expect(sharedPage.getByTestId("export-history-table")).toBeVisible();
  });

  test("8.1.2 — Dataset dropdown shows test dataset with delivered count", async () => {
    await sharedPage.getByTestId("export-dataset-select").click();
    await sharedPage.waitForTimeout(300);

    const option = sharedPage.locator('[role="option"]').filter({ hasText: datasetName });
    await expect(option).toBeVisible({ timeout: 5000 });
    await expect(option).toContainText("delivered");

    await option.click();
    await sharedPage.waitForTimeout(500);
  });

  test("8.1.3 — Selecting dataset shows delivered jobs table with correct row count", async () => {
    await expect(sharedPage.getByTestId("delivered-jobs-table")).toBeVisible({ timeout: 5000 });

    const rows = sharedPage.getByTestId("delivered-jobs-table").locator("tbody tr");
    const count = await rows.count();
    expect(count).toBe(deliveredJobIds.length);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.2 Delivered Jobs Table (continuing on same page with dataset selected)
  // ────────────────────────────────────────────────────────────────────────

  test("8.2.1 — Table has correct headers and checkboxes on each row", async () => {
    const table = sharedPage.getByTestId("delivered-jobs-table");

    await expect(table.locator("th").filter({ hasText: "File Name" })).toBeVisible();
    await expect(table.locator("th").filter({ hasText: "Annotator" })).toBeVisible();
    await expect(table.locator("th").filter({ hasText: "QA Reviewer" })).toBeVisible();
    await expect(table.locator("th").filter({ hasText: "Annotations" })).toBeVisible();
    await expect(table.locator("th").filter({ hasText: "Delivered Date" })).toBeVisible();

    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    const count = await checkboxes.count();
    expect(count).toBe(deliveredJobIds.length);
  });

  test("8.2.2 — Individual checkbox selection updates count and button states", async () => {
    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    const totalCount = await checkboxes.count();

    // Click first checkbox
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);

    const countText = sharedPage.getByTestId("export-selected-count");
    await expect(countText).toBeVisible();
    await expect(countText).toContainText(`1 of ${totalCount}`);

    // Preview enabled (exactly 1), export selected enabled
    await expect(sharedPage.getByTestId("preview-button")).toBeEnabled();
    await expect(sharedPage.getByTestId("export-selected-button")).toBeEnabled();

    if (totalCount >= 2) {
      await checkboxes.nth(1).click();
      await sharedPage.waitForTimeout(200);
      await expect(countText).toContainText(`2 of ${totalCount}`);
      // Preview disabled (more than 1)
      await expect(sharedPage.getByTestId("preview-button")).toBeDisabled();
      // Uncheck second
      await checkboxes.nth(1).click();
      await sharedPage.waitForTimeout(200);
    }

    // Uncheck first to reset
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);
  });

  test("8.2.3 — Select all checkbox selects all rows", async () => {
    const selectAll = sharedPage.getByTestId("select-all-checkbox");
    await selectAll.click();
    await sharedPage.waitForTimeout(200);

    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    const totalCount = await checkboxes.count();

    const countText = sharedPage.getByTestId("export-selected-count");
    await expect(countText).toContainText(`${totalCount} of ${totalCount}`);
  });

  test("8.2.4 — Select all again deselects all rows", async () => {
    const selectAll = sharedPage.getByTestId("select-all-checkbox");
    await selectAll.click();
    await sharedPage.waitForTimeout(200);

    await expect(sharedPage.getByTestId("export-selected-count")).not.toBeVisible();
    await expect(sharedPage.getByTestId("export-selected-button")).toBeDisabled();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.3 Export Preview
  // ────────────────────────────────────────────────────────────────────────

  test("8.3.1 — Select 1 job and click preview shows original and deidentified content", async () => {
    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);

    await sharedPage.getByTestId("preview-button").click();

    await expect(sharedPage.getByTestId("export-preview")).toBeVisible({ timeout: 10000 });
    await expect(sharedPage.getByTestId("original-content")).toBeVisible();
    await expect(sharedPage.getByTestId("deidentified-content")).toBeVisible();

    const originalText = await sharedPage.getByTestId("original-content").textContent();
    const deidentifiedText = await sharedPage.getByTestId("deidentified-content").textContent();
    expect(originalText!.length).toBeGreaterThan(0);
    expect(deidentifiedText!.length).toBeGreaterThan(0);
  });

  test("8.3.2 — De-identified content contains replacement tag pattern", async () => {
    const deidentifiedText = await sharedPage.getByTestId("deidentified-content").textContent();
    // ann.tag replaces annotated text, e.g. "email_address_1"
    expect(deidentifiedText).toMatch(/[a-z_]+_\d+/);
  });

  test("8.3.3 — Original and deidentified content are different", async () => {
    const originalText = await sharedPage.getByTestId("original-content").textContent();
    const deidentifiedText = await sharedPage.getByTestId("deidentified-content").textContent();
    expect(originalText).not.toBe(deidentifiedText);
  });

  test("8.3.4 — Click preview close hides preview", async () => {
    await sharedPage.getByTestId("preview-close").click();
    await expect(sharedPage.getByTestId("export-preview")).not.toBeVisible();

    // Uncheck the job to reset state
    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.4 Export & Download
  // ────────────────────────────────────────────────────────────────────────

  test("8.4.1 — Export selected jobs triggers download and shows success toast", async () => {
    const checkboxes = sharedPage.getByTestId("job-export-checkbox");
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);

    // Track window.open calls by overriding it
    let openedUrl = "";
    await sharedPage.evaluate(() => {
      (window as unknown as { _originalOpen: typeof window.open })._originalOpen = window.open;
      window.open = (url?: string | URL, ...args: unknown[]) => {
        (window as unknown as { _lastOpenUrl: string })._lastOpenUrl = String(url || "");
        return null;
      };
    });

    await sharedPage.getByTestId("export-selected-button").click();
    await waitForSuccessToast(sharedPage);

    openedUrl = await sharedPage.evaluate(() =>
      (window as unknown as { _lastOpenUrl: string })._lastOpenUrl || ""
    );
    expect(openedUrl).toMatch(/\/api\/exports\/.*\/download\//);

    // Restore window.open
    await sharedPage.evaluate(() => {
      window.open = (window as unknown as { _originalOpen: typeof window.open })._originalOpen;
    });

    // Uncheck
    await checkboxes.first().click();
    await sharedPage.waitForTimeout(200);
  });

  test("8.4.2 — Export all jobs triggers download and shows correct count", async () => {
    const totalCount = deliveredJobIds.length;
    const exportAllBtn = sharedPage.getByTestId("export-all-button");
    await expect(exportAllBtn).toContainText(`Export All (${totalCount})`);

    // Track window.open calls
    await sharedPage.evaluate(() => {
      (window as unknown as { _originalOpen: typeof window.open })._originalOpen = window.open;
      window.open = (url?: string | URL, ...args: unknown[]) => {
        (window as unknown as { _lastOpenUrl: string })._lastOpenUrl = String(url || "");
        return null;
      };
    });

    await exportAllBtn.click();
    await waitForSuccessToast(sharedPage);

    const openedUrl = await sharedPage.evaluate(() =>
      (window as unknown as { _lastOpenUrl: string })._lastOpenUrl || ""
    );
    expect(openedUrl).toMatch(/\/api\/exports\/.*\/download\//);

    // Restore window.open
    await sharedPage.evaluate(() => {
      window.open = (window as unknown as { _originalOpen: typeof window.open })._originalOpen;
    });
  });

  test("8.4.3 — Export history download button has correct href", async () => {
    // After exports, history table should have entries
    const downloadButtons = sharedPage.getByTestId("export-download-button");
    await expect(downloadButtons.first()).toBeVisible({ timeout: 5000 });

    const href = await downloadButtons.first().getAttribute("href");
    expect(href).toMatch(/\/api\/exports\/.*\/download\//);
  });

  test("8.4.4 — Export selected button disabled when no jobs selected", async () => {
    // Ensure nothing is selected
    const countText = sharedPage.getByTestId("export-selected-count");
    const isCountVisible = await countText.isVisible().catch(() => false);
    if (isCountVisible) {
      const selectAll = sharedPage.getByTestId("select-all-checkbox");
      await selectAll.click();
      await sharedPage.waitForTimeout(100);
      await selectAll.click();
      await sharedPage.waitForTimeout(100);
    }

    await expect(sharedPage.getByTestId("export-selected-button")).toBeDisabled();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.5 Export History
  // ────────────────────────────────────────────────────────────────────────

  test("8.5.1 — Export history table has correct columns and rows from previous exports", async () => {
    // Scroll to the history table section (it's below the delivered jobs)
    const historyTable = sharedPage.getByTestId("export-history-table");
    await historyTable.scrollIntoViewIfNeeded();
    await expect(historyTable).toBeVisible();

    await expect(historyTable.locator("th").filter({ hasText: "Export Date" })).toBeVisible();
    await expect(historyTable.locator("th").filter({ hasText: "Dataset" })).toBeVisible();
    await expect(historyTable.locator("th").filter({ hasText: "Jobs" })).toBeVisible();
    await expect(historyTable.locator("th").filter({ hasText: "Size" })).toBeVisible();
    await expect(historyTable.locator("th").filter({ hasText: "Exported By" })).toBeVisible();
    await expect(historyTable.locator("th").filter({ hasText: "Download" })).toBeVisible();

    // Should have at least 1 row (from 8.4 exports)
    const rows = historyTable.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("8.5.2 — Download button is an anchor with download attribute", async () => {
    const downloadButton = sharedPage.getByTestId("export-download-button").first();
    await expect(downloadButton).toBeVisible();

    const tagName = await downloadButton.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("a");

    const hasDownload = await downloadButton.evaluate((el) => el.hasAttribute("download"));
    expect(hasDownload).toBe(true);

    const href = await downloadButton.getAttribute("href");
    expect(href).toMatch(/\/api\/exports\/.*\/download\//);
  });

  // Cleanup: close the shared page context
  test("Cleanup — Close shared browser context", async () => {
    await sharedPage?.context()?.close();
  });
});
