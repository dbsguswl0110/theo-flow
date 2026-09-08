import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_URL || "http://127.0.0.1:5174",
    browserName: "chromium",
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
    screenshot: "only-on-failure",
  },
});
