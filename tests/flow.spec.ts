import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  let items: any[] = [];
  let folders: string[] = [];
  await page.route("**/api/folders", async (r) => {
    if (r.request().method() === "POST") {
      const { name } = r.request().postDataJSON();
      folders.push(name);
      await r.fulfill({ status: 201, json: { name } });
    } else await r.fulfill({ json: folders });
  });
  await page.route("**/api/items**", async (r) => {
    const req = r.request();
    if (req.method() === "POST") {
      const i = req.postDataJSON();
      items.unshift({ ...i, subtasks: [], photos: [] });
      await r.fulfill({ status: 201, json: { id: i.id } });
    } else if (req.method() === "PUT") {
      const i = req.postDataJSON();
      items = items.map((x) => (x.id === i.id ? i : x));
      await r.fulfill({ json: { ok: true } });
    } else await r.fulfill({ json: items });
  });
});
async function ready(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.waitForTimeout(500);
}
async function throwMemo(page: any, title: string, dx: number, dy: number) {
  await page
    .locator(".memo-pad")
    .getByRole("textbox", { name: "제목", exact: true })
    .fill(title);
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.waitForTimeout(400);
  const h = await page.locator(".memo-handle").boundingBox();
  const before = await page.locator(".memo-pad").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, {
    steps: 12,
  });
  await page.waitForTimeout(80);
  const during = await page.locator(".memo-pad").boundingBox();
  expect(
    Math.abs(during.x - before.x) + Math.abs(during.y - before.y),
  ).toBeGreaterThan(50);
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("등록되었습니다");
  await expect(page.locator(".memo-title")).toHaveValue("");
  await page.waitForTimeout(500);
}
async function assertSpace(page: any, width: number, height: number) {
  const b = (await page.locator(".memo-pad").boundingBox())!;
  expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThan(2);
  expect(b.y).toBeGreaterThan(0);
  expect(b.y + b.height).toBeLessThan(height);
  for (const selector of ["note", "task", "todo"]) {
    const a = (await page
      .locator('[data-target="' + selector + '"]')
      .boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(width);
    const overlap =
      Math.min(b.x + b.width, a.x + a.width) > Math.max(b.x, a.x) &&
      Math.min(b.y + b.height, a.y + a.height) > Math.max(b.y, a.y);
    expect(overlap, selector + " must not overlap memo").toBeFalsy();
  }
}
for (const [width, height] of [
  [344, 882],
  [360, 800],
  [412, 915],
  [768, 900],
  [900, 768],
  [1440, 900],
]) {
  test("TEO layout " + width + "x" + height, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await expect(page.locator(".theo-anchor")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "Project", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".wallpaper,.swipe-actions")).toHaveCount(0);
    await assertSpace(page, width, height);
    await page.screenshot({ path: "test-results/teo-" + width + ".png" });
    const idle = await page.locator(".memo-pad").boundingBox();
    await page.locator(".memo-title").fill("입력 중");
    await page.waitForTimeout(350);
    expect(
      (await page.locator(".memo-pad").boundingBox())!.width,
    ).toBeGreaterThan(idle!.width);
    await assertSpace(page, width, height);
    await expect(page.locator('[data-target="calendar"]')).toBeHidden();
    await expect(
      page.getByRole("textbox", { name: "마감일", exact: true }),
    ).toBeDisabled();
    await page.getByRole("switch", { name: "마감일 사용" }).click();
    await expect(
      page.getByRole("textbox", { name: "마감일", exact: true }),
    ).toBeEnabled();
    await page.getByRole("switch", { name: "마감일 사용" }).click();
    await expect(
      page.getByRole("textbox", { name: "마감일", exact: true }),
    ).toBeDisabled();
  });
}
test("three throws, folder classification, Todo child Task and combined calendar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await ready(page);
  await throwMemo(page, "개인 노트", -110, 0);
  await throwMemo(page, "독립 Task", 110, 0);
  await throwMemo(page, "업무 Todo", 0, -110);
  await page.locator('[data-target="note"] button').click({ force: true });
  await page.getByRole("button", { name: "+ 폴더", exact: true }).click();
  await page.getByRole("textbox", { name: "폴더 이름" }).fill("업무");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await page.getByLabel("개인 노트 폴더").selectOption("업무");
  await page.getByRole("button", { name: "미분류", exact: true }).click();
  await expect(page.locator(".collection-card")).toHaveCount(0);
  await page.getByRole("button", { name: "▱ 업무", exact: true }).click();
  await expect(page.locator(".collection-card")).toHaveCount(1);
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await expect(page.locator(".collection-panel")).toHaveCount(0);
  await page.locator('[data-target="todo"] button').click({ force: true });
  await page.locator(".collection-open").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "+ Task 추가", exact: true }).click();
  await page
    .locator(".child-task")
    .getByRole("textbox", { name: "제목", exact: true })
    .fill("자료 정리");
  await page
    .locator(".child-task")
    .getByRole("textbox", { name: "내용", exact: true })
    .fill("Task 내용");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator(".child-task summary")).toContainText("자료 정리");
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await expect(page.locator(".panel")).toHaveCount(0);
  await page.locator('[data-target="calendar"] button').click({ force: true });
  await expect(page.locator(".calendar-bar")).toHaveCount(3);
  await expect(
    page.locator(".calendar-bar").filter({ hasText: "개인 노트" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Task 목록", exact: true }).click();
  await expect(page.locator(".collection-open").first()).toContainText(
    "독립 Task",
  );
  await expect(page.locator(".collection-open").last()).toContainText(
    "자료 정리",
  );
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await expect(page.locator(".calendar-screen")).toBeVisible();
  await page.getByRole("button", { name: "Todo 목록", exact: true }).click();
  await expect(page.locator(".collection-open")).toContainText("업무 Todo");
});
test("keyboard viewport reserves classification icons and failed fling preserves draft", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await ready(page);
  await page.locator(".memo-handle").click();
  await expect(page.locator(".memo-title")).toBeFocused();
  await page.locator(".memo-title").fill("터치 메모");
  await page.setViewportSize({ width: 360, height: 460 });
  await page.waitForTimeout(400);
  await assertSpace(page, 360, 460);
  await page.screenshot({ path: "test-results/teo-keyboard.png" });
  const h = (await page.locator(".memo-handle").boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const x = h.x + h.width / 2,
    y = h.y + h.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let n = 1; n <= 10; n++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - n * 8, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByRole("status")).toContainText("노트");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(500);
  await page.locator(".memo-title").fill("연결 오류 메모");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.waitForTimeout(350);
  await page.route("**/api/items", (r) =>
    r.fulfill({ status: 503, json: { error: "offline" } }),
  );
  await page.locator(".memo-handle").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("alert")).toContainText("내용은 남아 있습니다");
  await expect(page.locator(".memo-title")).toHaveValue("연결 오류 메모");
});
