import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let items: any[] = [];
  await page.route("**/api/items**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const item = req.postDataJSON();
      items.unshift({ ...item, photos: [], subtasks: [], completed: false });
      await route.fulfill({ status: 201, json: { id: item.id } });
    } else if (req.method() === "PUT") {
      const item = req.postDataJSON();
      items = items.map((i) => (i.id === item.id ? item : i));
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: items });
  });
});

for (const [width, height] of [
  [344, 882],
  [360, 800],
  [412, 915],
  [768, 900],
  [900, 768],
  [1440, 900],
]) {
  test("stable composition " + width + "x" + height, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "건너뛰기" }).click();
    await expect(page.locator(".memo-pad")).toBeVisible();
    await page.waitForTimeout(900);
    const box = await page.locator(".memo-pad").boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.y).toBeGreaterThan(0);
    for (const el of await page.locator(".theo-anchor").all()) {
      const b = (await el.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(b.y + b.height).toBeLessThan(height);
      const overlap =
        Math.min(box!.x + box!.width, b.x + b.width) > Math.max(box!.x, b.x) &&
        Math.min(box!.y + box!.height, b.y + b.height) > Math.max(box!.y, b.y);
      expect(overlap).toBeFalsy();
    }
    await page.screenshot({ path: "test-results/home-" + width + ".png" });
    await page
      .getByRole("textbox", { name: "제목", exact: true })
      .fill("집중 모드");
    await page.waitForTimeout(350);
    const focused = (await page.locator(".memo-pad").boundingBox())!;
    expect(Math.abs(focused.x + focused.width / 2 - width / 2)).toBeLessThan(2);
    await expect(page.locator(".focus-overlay")).toBeVisible();
    await page.screenshot({ path: "test-results/focus-" + width + ".png" });
  });
}

test("finger tracking, three directions, edit, calendar and trash restore", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  for (const [title, dx, dy] of [
    ["왼쪽 노트", -140, 0],
    ["오른쪽 태스크", 140, 0],
    ["위쪽 프로젝트", 0, -150],
  ] as const) {
    await page.getByRole("textbox", { name: "제목", exact: true }).fill(title);
    await page
      .getByRole("textbox", { name: "내용", exact: true })
      .fill("스와이프 테스트");
    await page.getByLabel("시작일", { exact: true }).fill("2026-09-08");
    await page.getByLabel("마감일 방식").selectOption("date");
    await page.getByLabel("마감일", { exact: true }).fill("2026-09-12");
    await page
      .getByRole("button", { name: "작성 완료 · 스와이프하기" })
      .click();
    await page.waitForTimeout(400);
    const handle = (await page
      .getByRole("button", { name: "메모 스와이프 손잡이" })
      .boundingBox())!;
    const before = (await page.locator(".memo-pad").boundingBox())!;
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + dx,
      handle.y + handle.height / 2 + dy,
      { steps: 12 },
    );
    await page.waitForTimeout(100);
    const moving = (await page.locator(".memo-pad").boundingBox())!;
    expect(
      Math.abs(moving.x - before.x) + Math.abs(moving.y - before.y),
    ).toBeGreaterThan(100);
    await page.mouse.up();
    await expect(page.getByRole("status")).toContainText("등록되었습니다");
    await expect(
      page.getByRole("textbox", { name: "제목", exact: true }),
    ).toHaveValue("");
    await page.waitForTimeout(650);
    await expect(page.locator(".panel")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Calendar", exact: true })
    .click({ force: true });
  await expect(page.locator(".calendar-bar")).toHaveCount(3);
  await expect(page.locator(".calendar-bar").first()).toHaveCSS(
    "grid-column-end",
    "7",
  );
  await page.screenshot({ path: "test-results/calendar.png" });
  await page.getByRole("button", { name: "캘린더 닫기" }).click();
  await expect(page.locator(".calendar-screen")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Todo", exact: true })
    .click({ force: true });
  await page.locator(".collection-open").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "+ 할 일 추가", exact: true }).click();
  await page
    .getByRole("textbox", { name: "하위 할 일", exact: true })
    .fill("자료 정리");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "휴지통으로 이동" }).click();
  await expect(page.locator(".collection-open")).toHaveCount(0);
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.locator(".collection-open")).toHaveCount(1);
  await page.getByRole("button", { name: "복원", exact: true }).click();
  await expect(page.locator(".collection-open")).toHaveCount(0);
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await page.setViewportSize({ width: 900, height: 768 });
  await expect(page.locator(".home-stage")).toHaveClass(/expanded/);
  await expect(page.locator(".panel")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Todo", exact: true })
    .click({ force: true });
  await expect(page.getByText("자료 정리", { exact: true })).toBeVisible();
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
});

test("startup phases, touch swipe and keyboard-size viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.locator(".startup.phase-0")).toBeVisible();
  await expect(page.locator(".startup.phase-1")).toBeVisible();
  await page.screenshot({ path: "test-results/startup-split.png" });
  await expect(page.locator(".startup.phase-2")).toBeVisible();
  await page.screenshot({ path: "test-results/startup-faces.png" });
  await expect(page.locator(".startup")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "제목", exact: true })
    .fill("터치 메모");
  await page.setViewportSize({ width: 360, height: 480 });
  await page.waitForTimeout(400);
  const focusBox = (await page.locator(".memo-pad").boundingBox())!;
  expect(focusBox.y).toBeGreaterThanOrEqual(0);
  expect(focusBox.y + focusBox.height).toBeLessThan(480);
  await page.screenshot({ path: "test-results/keyboard.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "작성 완료 · 스와이프하기" }).click();
  await page.waitForTimeout(400);
  const handle = (await page.locator(".memo-handle").boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const x = handle.x + handle.width / 2,
    y = handle.y + handle.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let n = 1; n <= 12; n++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - n * 10, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByRole("status")).toContainText("노트");
  await expect(
    page.getByRole("textbox", { name: "제목", exact: true }),
  ).toHaveValue("");
});

test("cancelled gestures and failed save retain draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await page
    .getByRole("textbox", { name: "제목", exact: true })
    .fill("남아 있어야 하는 메모");
  await page.getByRole("button", { name: "작성 완료 · 스와이프하기" }).click();
  await page.waitForTimeout(400);
  const box = (await page.locator(".memo-handle").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("textbox", { name: "제목", exact: true }),
  ).toHaveValue("남아 있어야 하는 메모");
  await page.route("**/api/items", (r) =>
    r.fulfill({ status: 503, json: { error: "offline" } }),
  );
  await page.getByRole("button", { name: "Note로 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("내용은 남아 있습니다");
  await expect(
    page.getByRole("textbox", { name: "제목", exact: true }),
  ).toHaveValue("남아 있어야 하는 메모");
});
