import { test, expect } from "@playwright/test";
import {
  TestRole,
  getCredentials,
  loginViaUI,
} from "../fixtures/auth";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays login form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByTestId("login-email")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.getByTestId("login-email").fill("wrong@example.com");
    await page.getByTestId("login-password").fill("wrongpassword");
    await page.getByTestId("login-submit").click();

    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible();
  });

  test("disables sign-in button when fields are empty", async ({ page }) => {
    const signInBtn = page.getByTestId("login-submit");

    // Both empty → disabled
    await expect(signInBtn).toBeDisabled();

    // Only email filled → disabled
    await page.getByTestId("login-email").fill("test@example.com");
    await expect(signInBtn).toBeDisabled();

    // Clear email, fill password → disabled
    await page.getByTestId("login-email").clear();
    await page.getByTestId("login-password").fill("password");
    await expect(signInBtn).toBeDisabled();

    // Both filled → enabled
    await page.getByTestId("login-email").fill("test@example.com");
    await expect(signInBtn).toBeEnabled();
  });

  test("admin can login and reach admin dashboard", async ({ page }) => {
    const creds = getCredentials(TestRole.ADMIN);
    await loginViaUI(page, creds.email, creds.password);

    await page.waitForURL(`**${creds.dashboardPath}`);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("annotator can login and reach annotator dashboard", async ({
    page,
  }) => {
    const creds = getCredentials(TestRole.ANNOTATOR);
    await loginViaUI(page, creds.email, creds.password);

    await page.waitForURL(`**${creds.dashboardPath}`);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("QA can login and reach QA dashboard", async ({ page }) => {
    const creds = getCredentials(TestRole.QA);
    await loginViaUI(page, creds.email, creds.password);

    await page.waitForURL(`**${creds.dashboardPath}`);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("already-authenticated user is redirected away from login", async ({
    page,
  }) => {
    const creds = getCredentials(TestRole.ADMIN);
    await loginViaUI(page, creds.email, creds.password);
    await page.waitForURL(`**${creds.dashboardPath}`);

    // Navigate back to /login — should redirect to dashboard
    await page.goto("/login");
    await page.waitForURL(`**${creds.dashboardPath}`);
    await expect(page.getByTestId("login-email")).not.toBeVisible();
  });
});
