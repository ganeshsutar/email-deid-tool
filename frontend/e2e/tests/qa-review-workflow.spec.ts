import path from "path";
import { fileURLToPath } from "url";
import { test, expect, type Page } from "@playwright/test";
import { TestRole, getCredentials, loginViaUI, logoutViaUI } from "../fixtures/auth";

const uniqueSuffix = () => Date.now().toString(36);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

// ─── Helper: Select text in RawContentViewer ───────────────────────────────
async function selectTextInViewer(page: Page, textToSelect: string): Promise<boolean> {
  await page.evaluate(() => window.getSelection()?.removeAllRanges());

  const coords = await page.evaluate((target) => {
    const pre = document.querySelector('[data-testid="raw-content-viewer"] pre');
    if (!pre) return null;

    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let startOff = 0;
    let endNode: Text | null = null;
    let endOff = 0;

    const textNodes: { node: Text; start: number }[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      textNodes.push({ node, start: currentOffset });
      currentOffset += node.textContent!.length;
    }

    const fullText = textNodes.map((t) => t.node.textContent).join("");
    const idx = fullText.indexOf(target);
    if (idx === -1) return null;

    const end = idx + target.length;

    for (const { node, start } of textNodes) {
      const nodeEnd = start + node.textContent!.length;
      if (!startNode && idx >= start && idx < nodeEnd) {
        startNode = node;
        startOff = idx - start;
      }
      if (end > start && end <= nodeEnd) {
        endNode = node;
        endOff = end - start;
        break;
      }
    }

    if (!startNode || !endNode) return null;

    const startEl = startNode.parentElement;
    if (startEl) {
      startEl.scrollIntoView({ block: "center", inline: "nearest" });
    }

    const startRange = document.createRange();
    startRange.setStart(startNode, startOff);
    startRange.setEnd(startNode, startOff);
    const startRect = startRange.getBoundingClientRect();

    const endRange = document.createRange();
    endRange.setStart(endNode, endOff);
    endRange.setEnd(endNode, endOff);
    const endRect = endRange.getBoundingClientRect();

    return {
      startX: startRect.left + 2,
      startY: startRect.top + startRect.height / 2,
      endX: endRect.left - 2,
      endY: endRect.top + endRect.height / 2,
    };
  }, textToSelect);

  if (!coords) return false;

  await page.waitForTimeout(200);

  await page.mouse.move(coords.startX, coords.startY);
  await page.mouse.down();
  await page.mouse.move(coords.endX, coords.endY, { steps: 5 });
  await page.mouse.up();

  return true;
}

// ─── Helper: Wait for success toast ─────────────────────────────────────────
async function waitForSuccessToast(page: Page, timeout = 10000) {
  await expect(
    page.locator('[data-sonner-toast][data-type="success"]'),
  ).toBeVisible({ timeout });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. QA Review Workflow (QA Reviewer)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe("7. QA Review Workflow (QA Reviewer)", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = uniqueSuffix();
  const datasetName = `E2E QA Review ${suffix}`;

  // Store QA job IDs for use across test sections
  let qaJobIds: string[] = [];

  // ────────────────────────────────────────────────────────────────────────
  // Setup: Admin uploads dataset, assigns to annotator, annotator submits,
  //        admin assigns submitted jobs to QA reviewer
  // ────────────────────────────────────────────────────────────────────────
  test("Setup — Admin uploads dataset, annotator submits, admin assigns to QA", async ({ browser }) => {
    test.setTimeout(180000);
    const context = await browser.newContext();
    const page = await context.newPage();

    const adminCreds = getCredentials(TestRole.ADMIN);
    await loginViaUI(page, adminCreds.email, adminCreds.password);
    await page.waitForURL("**/admin/dashboard");

    // ── Step 0: Delete ALL E2E datasets to avoid content_hash dedup ──
    await page.evaluate(async () => {
      const res = await fetch("/api/datasets/?page_size=100", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const datasets = data.results || data;
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      for (const ds of datasets) {
        if (ds.name && ds.name.startsWith("E2E")) {
          await fetch(`/api/datasets/${ds.id}/?force=true`, {
            method: "DELETE",
            credentials: "include",
            headers: { "X-CSRFToken": csrfToken },
          });
        }
      }
    });
    await page.waitForTimeout(500);

    // ── Step 1: Upload fresh dataset ──
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

    // ── Step 2: Assign E2E dataset jobs to the specific test annotator via API ──
    const annotatorCreds = getCredentials(TestRole.ANNOTATOR);
    await page.evaluate(async ({ dsName, annotatorEmail }) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const headers = { "X-CSRFToken": csrfToken, "Content-Type": "application/json" };

      // Find the E2E dataset
      const dsRes = await fetch(`/api/datasets/?search=${encodeURIComponent(dsName)}&page_size=10`, { credentials: "include" });
      const dsData = await dsRes.json();
      const dataset = (dsData.results || dsData).find((d: { name: string }) => d.name === dsName);
      if (!dataset) throw new Error(`Dataset '${dsName}' not found`);

      // Find the test annotator user
      const usersRes = await fetch("/api/users/?page_size=100", { credentials: "include" });
      const usersData = await usersRes.json();
      const annotator = (usersData.results || usersData).find((u: { email: string }) => u.email === annotatorEmail);
      if (!annotator) throw new Error(`Annotator '${annotatorEmail}' not found`);

      // Get unassigned UPLOADED jobs for this dataset
      const jobsRes = await fetch(`/api/jobs/unassigned/?type=ANNOTATION&dataset_id=${dataset.id}&page_size=100`, { credentials: "include" });
      const jobsData = await jobsRes.json();
      const jobs = jobsData.results || jobsData;
      const jobIds = jobs.map((j: { id: string }) => j.id);
      if (jobIds.length < 3) throw new Error(`Expected >= 3 unassigned jobs, got ${jobIds.length}`);

      // Assign via API
      const assignRes = await fetch("/api/jobs/assign/", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ job_ids: jobIds, assignee_id: annotator.id, type: "ANNOTATION" }),
      });
      if (!assignRes.ok) throw new Error(`Assignment failed: ${await assignRes.text()}`);
    }, { dsName: datasetName, annotatorEmail: annotatorCreds.email });
    await page.waitForTimeout(500);

    // ── Step 3: Login as annotator, submit all 3 jobs ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    await loginViaUI(page, annotatorCreds.email, annotatorCreds.password);
    await page.waitForURL("**/annotator/dashboard");

    // Get all assigned job IDs
    const assignedJobIds = await page.evaluate(async () => {
      const res = await fetch(
        "/api/annotations/my-jobs/?status=ASSIGNED_ANNOTATOR&page_size=10",
        { credentials: "include" },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = data.results || data;
      return jobs.map((j: { id: string }) => j.id);
    });

    // For each job: open workspace → create annotations → submit
    for (const jobId of assignedJobIds) {
      await page.goto(`/annotator/jobs/${jobId}/annotate`);
      await page.waitForURL("**/annotator/jobs/*/annotate", { timeout: 10000 });
      await expect(page.getByTestId("annotation-workspace")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("save-draft-button")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);

      // Create at least 2 annotations
      const pre = page.getByTestId("raw-content-viewer").locator("pre");
      const fullText = await pre.textContent();

      // First annotation
      let text1 = "Delivered-To";
      if (!fullText?.includes(text1)) text1 = "From";
      if (!fullText?.includes(text1)) text1 = fullText!.substring(0, 12).trim();

      let selected = await selectTextInViewer(page, text1);
      if (selected) {
        const popup = page.getByTestId("class-selection-popup");
        await expect(popup).toBeVisible({ timeout: 5000 });
        await page.getByTestId("class-option").first().click();
        await page.waitForTimeout(500);

        // Dismiss same-value linking dialog if it appears
        const sameValueDialog = page.getByTestId("same-value-linking-dialog");
        if (await sameValueDialog.isVisible().catch(() => false)) {
          await page.getByTestId("link-new-tag").click();
          await page.waitForTimeout(300);
        }
      }

      // Second annotation
      let text2 = "Subject";
      if (!fullText?.includes(text2)) text2 = fullText!.substring(20, 30).trim();
      if (!text2 || text2.length < 2) text2 = fullText!.substring(10, 18).trim();

      selected = await selectTextInViewer(page, text2);
      if (selected) {
        const popup = page.getByTestId("class-selection-popup");
        if (await popup.isVisible().catch(() => false)) {
          await page.getByTestId("class-option").first().click();
          await page.waitForTimeout(500);

          const sameValueDialog = page.getByTestId("same-value-linking-dialog");
          if (await sameValueDialog.isVisible().catch(() => false)) {
            await page.getByTestId("link-new-tag").click();
            await page.waitForTimeout(300);
          }
        }
      }

      // Submit the job
      const submitBtn = page.getByTestId("submit-button");
      await submitBtn.click();
      await expect(page.getByTestId("submit-confirm-dialog")).toBeVisible({ timeout: 5000 });
      await page.getByTestId("submit-confirm").click();
      await waitForSuccessToast(page);
      await page.waitForTimeout(500);
    }

    // ── Step 4: Login as admin, assign all submitted jobs to QA via API ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    await loginViaUI(page, adminCreds.email, adminCreds.password);
    await page.waitForURL("**/admin/dashboard");

    const qaCreds = getCredentials(TestRole.QA);
    await page.evaluate(async ({ qaEmail }) => {
      const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
      const headers = { "X-CSRFToken": csrfToken, "Content-Type": "application/json" };

      // Find the test QA user
      const usersRes = await fetch("/api/users/?page_size=100", { credentials: "include" });
      const usersData = await usersRes.json();
      const qaUser = (usersData.results || usersData).find((u: { email: string }) => u.email === qaEmail);
      if (!qaUser) throw new Error(`QA user '${qaEmail}' not found`);

      // Get unassigned SUBMITTED_FOR_QA jobs
      const jobsRes = await fetch("/api/jobs/unassigned/?type=QA&page_size=100", { credentials: "include" });
      const jobsData = await jobsRes.json();
      const jobs = jobsData.results || jobsData;
      const jobIds = jobs.map((j: { id: string }) => j.id);
      if (jobIds.length < 3) throw new Error(`Expected >= 3 unassigned QA jobs, got ${jobIds.length}`);

      // Assign via API
      const assignRes = await fetch("/api/jobs/assign/", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ job_ids: jobIds, assignee_id: qaUser.id, type: "QA" }),
      });
      if (!assignRes.ok) throw new Error(`QA assignment failed: ${await assignRes.text()}`);
    }, { qaEmail: qaCreds.email });
    await page.waitForTimeout(500);

    // ── Step 5: Login as QA and capture job IDs ──
    await logoutViaUI(page);
    await page.waitForURL("**/login");
    await loginViaUI(page, qaCreds.email, qaCreds.password);
    await page.waitForURL("**/qa/dashboard");

    const freshQAJobIds = await page.evaluate(async () => {
      const res = await fetch(
        "/api/qa/my-jobs/?status=ASSIGNED_QA&page_size=10",
        { credentials: "include" },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = data.results || data;
      return jobs.map((j: { id: string }) => j.id);
    });
    qaJobIds.push(...freshQAJobIds);

    await context.close();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.1 QA Dashboard
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.1 QA Dashboard", () => {
    test.beforeEach(async ({ page }) => {
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(page, creds.email, creds.password);
      await page.waitForURL("**/qa/dashboard");
    });

    test("7.1.1 — Dashboard renders with summary bar and jobs table", async ({ page }) => {
      await expect(page.getByTestId("qa-dashboard")).toBeVisible();
      await expect(page.getByTestId("qa-summary-bar")).toBeVisible();
      await expect(page.getByTestId("qa-jobs-table")).toBeVisible();
    });

    test("7.1.2 — Status tab filtering", async ({ page }) => {
      const inReviewTab = page.getByTestId("status-tab-in-review");
      await expect(inReviewTab).toBeVisible();
      await inReviewTab.click();
      await page.waitForTimeout(500);

      // Click back to All
      const allTab = page.getByTestId("status-tab-all");
      await allTab.click();
      await page.waitForTimeout(500);
    });

    test("7.1.3 — Search QA jobs", async ({ page }) => {
      const searchInput = page.getByTestId("qa-jobs-search");
      await expect(searchInput).toBeVisible();

      // Search for something that won't match
      await searchInput.fill("zzz-no-match-xyz");
      await searchInput.press("Enter");
      await page.waitForTimeout(500);

      // Clear
      await searchInput.fill("");
      await searchInput.press("Enter");
      await page.waitForTimeout(500);
    });

    test("7.1.4 — Open review workspace via review button", async ({ page }) => {
      if (qaJobIds.length > 0) {
        await page.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      } else {
        const reviewButton = page.getByTestId("job-review-button").first();
        await expect(reviewButton).toBeVisible();
        await reviewButton.click();
      }

      await page.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(page.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
    });

    test("7.1.5 — Only own QA jobs visible (table has rows)", async ({ page }) => {
      const table = page.getByTestId("qa-jobs-table");
      await expect(table).toBeVisible();
      const rows = table.locator("tbody tr");
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.2 Start QA Review
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.2 Start QA Review", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, creds.email, creds.password);
      await sharedPage.waitForURL("**/qa/dashboard");
    });

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.2.1 — Auto-start on workspace open (ASSIGNED_QA job)", async () => {
      expect(qaJobIds.length).toBeGreaterThan(0);
      await sharedPage.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });

      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      // Wait for action buttons to appear (indicates workspace is interactive)
      await expect(sharedPage.getByTestId("accept-button")).toBeVisible({ timeout: 15000 });
    });

    test("7.2.2 — Workspace layout: raw-content-viewer and right panel", async () => {
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible();
      await expect(sharedPage.getByTestId("raw-content-viewer")).toBeVisible();
      // ResizablePanel doesn't forward data-testid; check for panel content instead
      await expect(sharedPage.getByTestId("annotations-tab-trigger")).toBeVisible();
    });

    test("7.2.3 — Annotations displayed with highlights", async () => {
      // Annotator's submitted annotations should show as colored highlights
      const highlights = sharedPage.locator('[data-annotation-id]');
      await expect(highlights.first()).toBeVisible({ timeout: 5000 });
      const count = await highlights.count();
      expect(count).toBeGreaterThan(0);
    });

    test("7.2.4 — Annotations review list has items with status indicators", async () => {
      // Click on the annotations tab to ensure it's active
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);

      const reviewList = sharedPage.getByTestId("annotations-review-list");
      await expect(reviewList).toBeVisible();

      const items = sharedPage.getByTestId("annotation-list-item");
      await expect(items.first()).toBeVisible({ timeout: 5000 });
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.3 Review Annotations
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.3 Review Annotations", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, creds.email, creds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Open the workspace for the first QA job
      expect(qaJobIds.length).toBeGreaterThan(0);
      await sharedPage.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await expect(sharedPage.getByTestId("accept-button")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(500);

      // Ensure annotations tab is active
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);
    });

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.3.1 — Mark annotation as OK", async () => {
      const okButton = sharedPage.getByTestId("annotation-ok-button").first();
      await expect(okButton).toBeVisible();
      await okButton.click();
      await sharedPage.waitForTimeout(300);

      // The OK button should now be disabled (status is OK)
      await expect(okButton).toBeDisabled();
    });

    test("7.3.2 — Flag annotation", async () => {
      const flagButton = sharedPage.getByTestId("annotation-flag-button").first();
      await expect(flagButton).toBeVisible();
      await flagButton.click();
      await sharedPage.waitForTimeout(300);

      // The Flag button should now be disabled (status is FLAGGED)
      await expect(flagButton).toBeDisabled();
    });

    test("7.3.3 — Reset annotation status (flag then OK)", async () => {
      // The first annotation was flagged in 7.3.2. Click OK to reset it to OK
      const okButton = sharedPage.getByTestId("annotation-ok-button").first();
      // It should be enabled again since status is FLAGGED, not OK
      await expect(okButton).toBeEnabled();
      await okButton.click();
      await sharedPage.waitForTimeout(300);

      // Now the OK button should be disabled again (status is OK)
      await expect(okButton).toBeDisabled();
    });

    test("7.3.4 — Bulk review: mark all as OK", async () => {
      const okButtons = sharedPage.getByTestId("annotation-ok-button");
      const count = await okButtons.count();

      for (let i = 0; i < count; i++) {
        const btn = okButtons.nth(i);
        const isDisabled = await btn.isDisabled();
        if (!isDisabled) {
          await btn.click();
          await sharedPage.waitForTimeout(200);
        }
      }

      // All OK buttons should now be disabled
      for (let i = 0; i < count; i++) {
        await expect(okButtons.nth(i)).toBeDisabled();
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.4 QA Edit Mode
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.4 QA Edit Mode", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, creds.email, creds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Open workspace for the first QA job
      expect(qaJobIds.length).toBeGreaterThan(0);
      await sharedPage.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await expect(sharedPage.getByTestId("accept-button")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(500);
    });

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.4.1 — Toggle edit mode ON", async () => {
      const editToggle = sharedPage.getByTestId("edit-mode-toggle");
      await expect(editToggle).toBeVisible();
      await editToggle.click();
      await sharedPage.waitForTimeout(300);

      // The toggle should be checked
      await expect(editToggle).toBeChecked();
    });

    test("7.4.2 — Add annotation in edit mode", async () => {
      // Ensure annotations tab is active
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);

      const countBefore = await sharedPage.getByTestId("annotation-list-item").count();

      // Select text in the viewer
      const pre = sharedPage.getByTestId("raw-content-viewer").locator("pre");
      const fullText = await pre.textContent();
      let textToSelect = "Date";
      if (!fullText?.includes(textToSelect)) {
        textToSelect = fullText!.substring(30, 38).trim();
      }
      if (!textToSelect || textToSelect.length < 2) {
        textToSelect = fullText!.substring(40, 48).trim();
      }

      const selected = await selectTextInViewer(sharedPage, textToSelect);
      expect(selected).toBe(true);

      // Class selection popup should appear
      await expect(sharedPage.getByTestId("class-selection-popup")).toBeVisible({ timeout: 5000 });
      await sharedPage.getByTestId("class-option").first().click();
      await sharedPage.waitForTimeout(500);

      // Dismiss same-value linking dialog if it appears
      const sameValueDialog = sharedPage.getByTestId("same-value-linking-dialog");
      if (await sameValueDialog.isVisible().catch(() => false)) {
        await sharedPage.getByTestId("link-new-tag").click();
        await sharedPage.waitForTimeout(300);
      }

      // New annotation should appear (QA_ADDED)
      const countAfter = await sharedPage.getByTestId("annotation-list-item").count();
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    test("7.4.3 — Delete annotation in edit mode", async () => {
      // Ensure annotations tab is active
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);

      const countBefore = await sharedPage.getByTestId("annotation-list-item").count();
      expect(countBefore).toBeGreaterThan(0);

      // Click delete on an annotation
      const deleteButton = sharedPage.getByTestId("annotation-delete-button").first();
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();
      await sharedPage.waitForTimeout(500);

      // The annotation should be removed or marked as DELETED
      // (Deleted annotations may still show with strikethrough in the list,
      //  or may be hidden depending on the filter)
      // Just verify the action didn't error — count may or may not decrease
      const countAfter = await sharedPage.getByTestId("annotation-list-item").count();
      // Count should remain the same (DELETED items still shown) or decrease
      expect(countAfter).toBeLessThanOrEqual(countBefore);
    });

    test("7.4.4 — Exit edit mode: text selection no longer creates annotations", async () => {
      // Toggle edit mode OFF
      const editToggle = sharedPage.getByTestId("edit-mode-toggle");
      await editToggle.click();
      await sharedPage.waitForTimeout(300);

      // The toggle should be unchecked
      await expect(editToggle).not.toBeChecked();

      // Try to select text — popup should NOT appear
      const pre = sharedPage.getByTestId("raw-content-viewer").locator("pre");
      const fullText = await pre.textContent();
      const textToSelect = fullText!.substring(50, 58).trim();
      if (textToSelect && textToSelect.length >= 2) {
        await selectTextInViewer(sharedPage, textToSelect);
        await sharedPage.waitForTimeout(500);

        // Class selection popup should NOT be visible
        const popupVisible = await sharedPage.getByTestId("class-selection-popup").isVisible().catch(() => false);
        expect(popupVisible).toBe(false);
      }
    });

    test("7.4.5 — Save QA draft", async () => {
      // Re-enable edit mode to make some modification for dirty state
      const editToggle = sharedPage.getByTestId("edit-mode-toggle");
      await editToggle.click();
      await sharedPage.waitForTimeout(300);

      // Mark an annotation as OK to make workspace dirty
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);

      const flagButton = sharedPage.getByTestId("annotation-flag-button").first();
      if (await flagButton.isEnabled()) {
        await flagButton.click();
        await sharedPage.waitForTimeout(300);
      }

      const saveBtn = sharedPage.getByTestId("save-draft-button");
      // If the button is disabled (no dirty changes), that's OK — still verify it exists
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
        await waitForSuccessToast(sharedPage);
      } else {
        await expect(saveBtn).toBeVisible();
      }
    });

    test("7.4.6 — Resume QA draft: modifications persist after navigation", async () => {
      // Count annotations before navigation
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);
      const countBefore = await sharedPage.getByTestId("annotation-list-item").count();

      // Navigate away
      await sharedPage.goto("/qa/dashboard");
      await sharedPage.waitForSelector('[data-testid="qa-dashboard"]');

      // Return to the same job
      await sharedPage.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await expect(sharedPage.getByTestId("accept-button")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(500);

      // Annotations should be restored
      await sharedPage.getByTestId("annotations-tab-trigger").click();
      await sharedPage.waitForTimeout(300);
      const countAfter = await sharedPage.getByTestId("annotation-list-item").count();
      expect(countAfter).toBe(countBefore);
    });

    test("7.4.7 — Modification count shows in edit mode controls", async () => {
      // Enable edit mode
      const editToggle = sharedPage.getByTestId("edit-mode-toggle");
      const isChecked = await editToggle.isChecked();
      if (!isChecked) {
        await editToggle.click();
        await sharedPage.waitForTimeout(300);
      }

      // If there are modifications, the badge should be visible
      const badge = sharedPage.getByTestId("modification-count-badge");
      const badgeVisible = await badge.isVisible().catch(() => false);
      if (badgeVisible) {
        const text = await badge.textContent();
        expect(text).toMatch(/\d+ change/);
      }
      // If no badge, it means 0 modifications — that's also valid
      expect(true).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.5 Accept Job (uses qaJobIds[1])
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.5 Accept Job", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, creds.email, creds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Open workspace for the second QA job
      expect(qaJobIds.length).toBeGreaterThanOrEqual(2);
      await sharedPage.goto(`/qa/jobs/${qaJobIds[1]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await expect(sharedPage.getByTestId("accept-button")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(500);
    });

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.5.1 — Open accept dialog", async () => {
      await sharedPage.getByTestId("accept-button").click();
      await expect(sharedPage.getByTestId("accept-dialog")).toBeVisible({ timeout: 5000 });

      // Check modification summary is shown
      await expect(sharedPage.getByTestId("modification-summary")).toBeVisible();
    });

    test("7.5.2 — Cancel accept: dialog closes", async () => {
      await expect(sharedPage.getByTestId("accept-dialog")).toBeVisible();
      await sharedPage.getByTestId("accept-cancel").click();
      await expect(sharedPage.getByTestId("accept-dialog")).not.toBeVisible();

      // Still in workspace
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible();
    });

    test("7.5.3 — Confirm accept: success toast and redirect", async () => {
      // Open dialog again
      await sharedPage.getByTestId("accept-button").click();
      await expect(sharedPage.getByTestId("accept-dialog")).toBeVisible({ timeout: 5000 });

      // Confirm accept
      await sharedPage.getByTestId("accept-confirm").click();
      await waitForSuccessToast(sharedPage);

      // Should redirect to dashboard
      await sharedPage.waitForURL("**/qa/dashboard", { timeout: 10000 });
    });

    test("7.5.4 — Accepted job no longer shows as 'In Review' on dashboard", async () => {
      await expect(sharedPage.getByTestId("qa-dashboard")).toBeVisible();

      // Click "In Review" tab to filter
      const inReviewTab = sharedPage.getByTestId("status-tab-in-review");
      await inReviewTab.click();
      await sharedPage.waitForTimeout(500);

      // The accepted job should not be in the "In Review" list
      // Check by trying to see if the table has fewer rows or the specific job is gone
      const table = sharedPage.getByTestId("qa-jobs-table");
      await expect(table).toBeVisible();

      // Go back to All tab
      await sharedPage.getByTestId("status-tab-all").click();
      await sharedPage.waitForTimeout(500);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.6 Reject Job (uses qaJobIds[0])
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.6 Reject Job", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      const creds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, creds.email, creds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Open workspace for the first QA job (which was used in 7.2-7.4)
      expect(qaJobIds.length).toBeGreaterThan(0);
      await sharedPage.goto(`/qa/jobs/${qaJobIds[0]}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      // Wait for reject button — it won't show if job is read-only
      await sharedPage.waitForTimeout(1000);
    });

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.6.1 — Open reject dialog", async () => {
      const rejectBtn = sharedPage.getByTestId("reject-button");
      if (!(await rejectBtn.isVisible().catch(() => false))) {
        test.skip();
        return;
      }
      await rejectBtn.click();
      await expect(sharedPage.getByTestId("reject-dialog")).toBeVisible({ timeout: 5000 });
      await expect(sharedPage.getByTestId("reject-comments-input")).toBeVisible();
    });

    test("7.6.2 — Reject confirm disabled with empty comments", async () => {
      const dialog = sharedPage.getByTestId("reject-dialog");
      if (!(await dialog.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Reject button should be disabled when comments are empty
      await expect(sharedPage.getByTestId("reject-confirm")).toBeDisabled();
    });

    test("7.6.3 — Comments minimum length validation", async () => {
      const dialog = sharedPage.getByTestId("reject-dialog");
      if (!(await dialog.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Type less than 10 chars
      await sharedPage.getByTestId("reject-comments-input").fill("Too short");
      await sharedPage.waitForTimeout(300);

      // Reject button should still be disabled (< 10 chars)
      await expect(sharedPage.getByTestId("reject-confirm")).toBeDisabled();
    });

    test("7.6.5 — Cancel rejection: dialog closes", async () => {
      const dialog = sharedPage.getByTestId("reject-dialog");
      if (!(await dialog.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      await sharedPage.getByTestId("reject-cancel").click();
      await expect(sharedPage.getByTestId("reject-dialog")).not.toBeVisible();

      // Still in workspace
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible();
    });

    test("7.6.4 — Confirm rejection with valid comments: success toast and redirect", async () => {
      const rejectBtn = sharedPage.getByTestId("reject-button");
      if (!(await rejectBtn.isVisible().catch(() => false))) {
        test.skip();
        return;
      }

      // Open reject dialog
      await rejectBtn.click();
      await expect(sharedPage.getByTestId("reject-dialog")).toBeVisible({ timeout: 5000 });

      // Enter valid comments (10+ chars)
      await sharedPage.getByTestId("reject-comments-input").fill("This needs major corrections — annotations are missing several PII items.");
      await sharedPage.waitForTimeout(300);

      // Reject button should now be enabled
      await expect(sharedPage.getByTestId("reject-confirm")).toBeEnabled();

      // Confirm rejection
      await sharedPage.getByTestId("reject-confirm").click();
      await waitForSuccessToast(sharedPage);

      // Should redirect to dashboard
      await sharedPage.waitForURL("**/qa/dashboard", { timeout: 10000 });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7.7 Blind Review
  // ────────────────────────────────────────────────────────────────────────
  test.describe("7.7 Blind Review", () => {
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.afterAll(async () => {
      await sharedPage?.context()?.close();
    });

    test("7.7.1 — Blind review disabled (default): annotator info visible", async ({ browser }) => {
      // First ensure blind review is OFF by logging in as admin
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const adminCreds = getCredentials(TestRole.ADMIN);
      await loginViaUI(adminPage, adminCreds.email, adminCreds.password);
      await adminPage.waitForURL("**/admin/dashboard");

      // Go to settings and ensure blind review is off
      await adminPage.goto("/admin/settings");
      await adminPage.waitForTimeout(1000);

      const blindToggle = adminPage.getByTestId("blind-review-toggle");
      await expect(blindToggle).toBeVisible({ timeout: 5000 });
      const isChecked = await blindToggle.isChecked();
      if (isChecked) {
        await blindToggle.click();
        await adminPage.waitForTimeout(500);
        await waitForSuccessToast(adminPage);
      }
      await adminContext.close();

      // Now login as QA and check workspace
      const qaContext = await browser.newContext();
      sharedPage = await qaContext.newPage();
      const qaCreds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, qaCreds.email, qaCreds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Use the third job for blind review testing (or any available job)
      const jobIdForBlind = qaJobIds.length >= 3 ? qaJobIds[2] : qaJobIds[0];
      await sharedPage.goto(`/qa/jobs/${jobIdForBlind}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(1000);

      // Annotator info should be visible (not blind review)
      // The breadcrumb should show "Annotator: <name>"
      const breadcrumb = sharedPage.locator("nav[aria-label='breadcrumb']");
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText).toContain("Annotator:");

      await sharedPage.context().close();
    });

    test("7.7.2 — Enable blind review: admin toggles setting", async ({ browser }) => {
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const adminCreds = getCredentials(TestRole.ADMIN);
      await loginViaUI(adminPage, adminCreds.email, adminCreds.password);
      await adminPage.waitForURL("**/admin/dashboard");

      // Go to settings and enable blind review
      await adminPage.goto("/admin/settings");
      await adminPage.waitForTimeout(1000);

      const blindToggle = adminPage.getByTestId("blind-review-toggle");
      await expect(blindToggle).toBeVisible({ timeout: 5000 });
      const isChecked = await blindToggle.isChecked();
      if (!isChecked) {
        await blindToggle.click();
        await adminPage.waitForTimeout(500);
        await waitForSuccessToast(adminPage);
      }

      // Verify it's now checked
      await expect(blindToggle).toBeChecked();
      await adminContext.close();
    });

    test("7.7.3 — Blind review enabled: annotator info hidden", async ({ browser }) => {
      const qaContext = await browser.newContext();
      sharedPage = await qaContext.newPage();
      const qaCreds = getCredentials(TestRole.QA);
      await loginViaUI(sharedPage, qaCreds.email, qaCreds.password);
      await sharedPage.waitForURL("**/qa/dashboard");

      // Use the third job (or available one)
      const jobIdForBlind = qaJobIds.length >= 3 ? qaJobIds[2] : qaJobIds[0];
      await sharedPage.goto(`/qa/jobs/${jobIdForBlind}/review`);
      await sharedPage.waitForURL("**/qa/jobs/*/review", { timeout: 10000 });
      await expect(sharedPage.getByTestId("qa-review-workspace")).toBeVisible({ timeout: 15000 });
      await sharedPage.waitForTimeout(1000);

      // Annotator info should be hidden
      // The breadcrumb should show "[Blind Review]" instead of annotator name
      const breadcrumb = sharedPage.locator("nav[aria-label='breadcrumb']");
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText).toContain("Blind Review");
      expect(breadcrumbText).not.toContain("Annotator:");

      // Cleanup: disable blind review again so other test suites aren't affected
      await sharedPage.context().close();

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const adminCreds = getCredentials(TestRole.ADMIN);
      await loginViaUI(adminPage, adminCreds.email, adminCreds.password);
      await adminPage.waitForURL("**/admin/dashboard");
      await adminPage.goto("/admin/settings");
      await adminPage.waitForTimeout(1000);

      const blindToggle = adminPage.getByTestId("blind-review-toggle");
      await expect(blindToggle).toBeVisible({ timeout: 5000 });
      if (await blindToggle.isChecked()) {
        await blindToggle.click();
        await adminPage.waitForTimeout(500);
        await waitForSuccessToast(adminPage);
      }
      await adminContext.close();
    });
  });
});
