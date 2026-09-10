import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
});

for (const [width, height] of [
  [360, 800],
  [412, 915],
  [768, 900],
  [1440, 900],
]) {
  test(`launch joins real icon positions without overshoot ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".launch")).toBeVisible();
    await expect(page.locator(".spatial-home")).toHaveAttribute("inert", "");
    const samples = await page.evaluate(async () => {
      const result: {
        kind: string;
        distance: number;
        match: number;
        atEnd: boolean;
      }[] = [];
      const start = performance.now();
      while (
        document.querySelector(".launch") &&
        performance.now() - start < 6000
      ) {
        const stage = document
          .querySelector(".home-stage")!
          .getBoundingClientRect();
        document
          .querySelectorAll<SVGGElement>("[data-launch-target]")
          .forEach((drop) => {
            const kind = drop.dataset.launchTarget!;
            const endX = Number(drop.dataset.endX),
              endY = Number(drop.dataset.endY);
            const ellipse = drop.querySelector("ellipse")!;
            const art = document
              .querySelector(`[data-target="${kind}"] .theo-art`)!
              .getBoundingClientRect();
            result.push({
              kind,
              distance: Math.hypot(
                ellipse.cx.baseVal.value - endX,
                ellipse.cy.baseVal.value - endY,
              ),
              match: Math.hypot(
                endX - (art.x + art.width / 2 - stage.x),
                endY - (art.y + art.height / 2 - stage.y),
              ),
              atEnd: !document.querySelector(".intro-waiting"),
            });
          });
        await new Promise(requestAnimationFrame);
      }
      return result;
    });
    for (const kind of ["todo", "note", "task", "calendar"]) {
      const values = samples.filter((s) => s.kind === kind);
      expect(values.length).toBeGreaterThan(5);
      expect(Math.max(...values.map((s) => s.match))).toBeLessThan(1);
      for (let i = 1; i < values.length; i++) {
        expect(values[i].distance).toBeLessThanOrEqual(
          values[i - 1].distance + 0.15,
        );
      }
      const handoff = values.filter((s) => s.atEnd);
      expect(handoff.length).toBeGreaterThan(0);
      expect(Math.max(...handoff.map((s) => s.distance))).toBeLessThan(1);
    }
    await expect(page.locator(".launch")).toHaveCount(0);
    await expect(page.locator(".spatial-home")).not.toHaveAttribute(
      "inert",
      "",
    );
    await page.locator(".memo-title").fill("시작 후 입력 확인");
    await expect(page.locator(".memo-title")).toHaveValue("시작 후 입력 확인");
  });
}

test("skip and replay restore interaction without duplicate overlays", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.getByRole("button", { name: "Setting", exact: true }).click();
  await page.getByRole("button", { name: "시작 애니메이션 다시 보기" }).click();
  await expect(page.locator(".startup")).toHaveCount(1);
  await expect(page.locator(".spatial-home")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.locator(".memo-title").fill("다시 보기 후 입력");
});

test("unfolding during entry updates destinations without restarting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForTimeout(300);
  const matches = await page
    .locator("[data-launch-target]")
    .evaluateAll((drops) => {
      const stage = document
        .querySelector(".home-stage")!
        .getBoundingClientRect();
      return drops.map((drop) => {
        const b = document
          .querySelector(
            `[data-target="${drop.getAttribute("data-launch-target")}"] .theo-art`,
          )!
          .getBoundingClientRect();
        return Math.hypot(
          Number(drop.getAttribute("data-end-x")) -
            (b.x + b.width / 2 - stage.x),
          Number(drop.getAttribute("data-end-y")) -
            (b.y + b.height / 2 - stage.y),
        );
      });
    });
  expect(matches.length).toBe(4);
  expect(Math.max(...matches)).toBeLessThan(1);
  await expect(page.locator(".startup")).toHaveCount(0, { timeout: 4000 });
});

test("unavailable network and artwork never leave a blocking intro", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/assets/theo-navigation.png", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".startup")).toHaveCount(0, { timeout: 6000 });
  await page.locator(".memo-title").fill("연결 없이 입력");
});

test("system reduced motion and in-app quiet preference bypass launch", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".startup")).toHaveCount(0);
  await expect(page.locator(".spatial-home")).not.toHaveAttribute("inert", "");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("theo-quiet", "true"));
  await page.reload();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.locator(".memo-title").fill("움직임 없이 입력");
});
