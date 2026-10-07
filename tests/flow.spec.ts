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
    const editing = (await page.locator(".memo-pad").boundingBox())!;
    // Narrow layouts grow vertically rather than covering the swipe destinations.
    expect(editing.width).toBeGreaterThanOrEqual(idle!.width - 0.5);
    expect(editing.width * editing.height).toBeGreaterThan(
      idle!.width * idle!.height,
    );
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
  // Notes never draw on the month grid; they sit in the Information columns with To Do and Task.
  const column = (kind: string) =>
    page.locator(`.calendar-information-column.${kind}`);
  await expect(column("note")).toContainText("개인 노트");
  await expect(column("task")).toContainText("독립 Task");
  await expect(column("task")).toContainText("자료 정리");
  await expect(column("todo")).toContainText("업무 Todo");
  await page.getByRole("button", { name: "캘린더 닫기" }).click();
  await expect(page.locator(".calendar-screen")).toHaveCount(0);
});
test("widget deep link opens the list once and one back returns home", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await ready(page);
  const before = await page.evaluate(() => history.length);
  // The Android shell re-sends the link while the page loads.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("theo-widget-open", { detail: "note" }),
      ),
    );
    await page.waitForTimeout(200);
  }
  await expect(page.locator(".collection-panel")).toHaveCount(1);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.getByRole("button", { name: "목록 닫기" }).click();
  await expect(page.locator(".collection-panel")).toHaveCount(0);
});
test("permanent delete asks first and updates the trash in place", async ({
  page,
}) => {
  const base = {
    content: "",
    completed: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    subtasks: [],
    photos: [],
    folder: null,
    type: "note",
    startDate: "2026-10-05",
    dueDate: null,
  };
  let items: any[] = [
    { ...base, id: "t1", title: "옛 메모", deletedAt: "2026-10-04T00:00:00Z" },
    { ...base, id: "t2", title: "지난 회의", deletedAt: "2026-10-04T00:00:00Z" },
    { ...base, id: "t3", title: "남는 메모", deletedAt: "2026-10-04T00:00:00Z" },
  ];
  const deleted: string[] = [];
  await page.route("**/api/items**", async (r) => {
    const req = r.request();
    if (req.method() === "DELETE") {
      const id = req.url().split("/").pop()!;
      deleted.push(id);
      items = items.filter((i) => i.id !== id);
      await r.fulfill({ json: { ok: true } });
    } else await r.fulfill({ json: items });
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await ready(page);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page.getByLabel("옛 메모 선택").check();
  await page.getByLabel("지난 회의 선택").check();
  await page.getByRole("button", { name: "영구삭제", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "2개를 영구 삭제할까요?",
  );
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(deleted).toHaveLength(0);
  await page.getByRole("button", { name: "영구삭제", exact: true }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2개를 영구 삭제했어요");
  await expect(page.locator(".collection-card")).toHaveCount(1);
  await expect(page.locator(".collection-card")).toContainText("남는 메모");
  // Staying on the trash screen means the page was not reloaded.
  await expect(page.locator(".collection-panel")).toHaveCount(1);
  expect(deleted.sort()).toEqual(["t1", "t2"]);
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
