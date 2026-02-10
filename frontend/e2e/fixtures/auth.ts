import type { Page } from "@playwright/test";
import { testUsers } from "../config";

export const TestRole = {
  ADMIN: "ADMIN",
  ANNOTATOR: "ANNOTATOR",
  QA: "QA",
} as const;

export type TestRole = (typeof TestRole)[keyof typeof TestRole];

export const ROLE_DASHBOARDS: Record<TestRole, string> = {
  [TestRole.ADMIN]: "/admin/dashboard",
  [TestRole.ANNOTATOR]: "/annotator/dashboard",
  [TestRole.QA]: "/qa/dashboard",
};

const ROLE_CREDENTIALS: Record<TestRole, { email: string; password: string }> =
  {
    [TestRole.ADMIN]: testUsers.admin,
    [TestRole.ANNOTATOR]: testUsers.annotator,
    [TestRole.QA]: testUsers.qa,
  };

export function getCredentials(role: TestRole) {
  return {
    ...ROLE_CREDENTIALS[role],
    dashboardPath: ROLE_DASHBOARDS[role],
  };
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}
