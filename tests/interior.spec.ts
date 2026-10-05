import { test, expect, type Page } from "@playwright/test";

const dayKey = (offset = 0) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const base = {
  content: "",
  completed: false,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  photos: [],
  deletedAt: null,
  folder: null,
  subtasks: [],
  dueDate: null,
  startDate: dayKey(0),
};

async function mockApi(page: Page, seed: any[]) {
  let items = [...seed];
  const saved: any[] = [];
  await page.route("**/api/folders", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/items**", async (r) => {
    const req = r.request();
    if (req.method() === "PUT") {
      const item = req.postDataJSON();
      saved.push(item);
      items = items.map((x) => (x.id === item.id ? { ...x, ...item } : x));
      await r.fulfill({ json: { ok: true } });
    } else if (req.method() === "POST") {
      const item = req.postDataJSON();
      items = [{ ...base, ...item, subtasks: [] }, ...items];
      await r.fulfill({ status: 201, json: { id: item.id } });
    } else await r.fulfill({ json: items });
  });
  return saved;
}
async function ready(page: Page) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.waitForTimeout(600);
}
async function swipe(page: Page, card: ReturnType<Page["locator"]>, dx: number) {
  const box = (await card.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 6 });
  await page.mouse.move(x + dx, y, { steps: 6 });
  await page.mouse.up();
}

test("the widget plus link skips the intro and opens a ready-to-write Note composer", async ({ page }) => {
  await mockApi(page, []);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");
  await expect(page.locator(".startup")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("theo-widget-open", { detail: "new-note" })));
  await expect(page.locator(".startup")).toHaveCount(0);
  await expect(page.locator(".collection-panel")).toHaveCount(1);
  await expect(page.locator(".inline-composer")).toBeVisible();
  await expect(page.locator(".inline-composer .memo-title")).toBeFocused();
  // A repeated link does not stack another history entry or close the composer.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("theo-widget-open", { detail: "new-note" })));
  await expect(page.locator(".inline-composer")).toBeVisible();
});

test("the Task list shows open work first, completed work after, and tick-off keeps the order honest", async ({
  page,
}) => {
  const saved = await mockApi(page, [
    { ...base, id: "a", type: "task", title: "먼저 할 일", dueDate: dayKey(3) },
    { ...base, id: "b", type: "task", title: "이미 한 일", completed: true },
    {
      ...base,
      id: "t",
      type: "todo",
      title: "프로젝트",
      subtasks: [{ id: "s1", title: "프로젝트 속 Task", completed: false, content: "", startDate: dayKey(0), dueDate: null }],
    },
  ]);
  await ready(page);
  await page.locator('[data-target="task"] button').click({ force: true });
  const titles = page.locator(".collection-open strong");
  await expect(titles).toHaveText(["먼저 할 일", "프로젝트 속 Task", "이미 한 일"]);
  await expect(page.locator(".tc-section")).toHaveText("완료 1");
  // Items with a due date show a deadline bar; the child Task names its Todo.
  await expect(page.locator(".collection-card").first().locator(".tc-deadline")).toHaveCount(1);
  await expect(page.locator(".tc-chip-parent")).toContainText("프로젝트");

  await page.getByRole("button", { name: "먼저 할 일 완료 표시" }).click();
  await expect(page.locator(".burst-layer .burst-piece").first()).toBeVisible();
  expect(saved.at(-1)).toMatchObject({ id: "a", completed: true });
  await expect(page.locator(".tc-section")).toHaveText("완료 2");

  await page.getByRole("button", { name: "프로젝트 속 Task 완료 표시" }).click();
  await expect.poll(() => saved.at(-1)?.subtasks?.[0]?.completed).toBe(true);
});

test("swiping a card right completes it and left moves it to the trash; short swipes spring back", async ({
  page,
}) => {
  const saved = await mockApi(page, [
    { ...base, id: "a", type: "task", title: "스와이프로 완료" },
    { ...base, id: "b", type: "task", title: "스와이프로 삭제" },
    { ...base, id: "c", type: "task", title: "살짝만 밀기" },
  ]);
  await ready(page);
  await page.locator('[data-target="task"] button').click({ force: true });
  await page.waitForTimeout(700);

  await swipe(page, page.locator(".collection-card", { hasText: "살짝만 밀기" }), 40);
  await page.waitForTimeout(500);
  expect(saved).toHaveLength(0);

  await swipe(page, page.locator(".collection-card", { hasText: "스와이프로 완료" }), 150);
  await expect.poll(() => saved.at(-1)).toMatchObject({ id: "a", completed: true });

  await swipe(page, page.locator(".collection-card", { hasText: "스와이프로 삭제" }), -150);
  await expect.poll(() => saved.at(-1)?.deletedAt).toBeTruthy();
  expect(saved.at(-1)).toMatchObject({ id: "b" });
  await expect(page.locator(".collection-card", { hasText: "스와이프로 삭제" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "휴지통으로 옮겼어요" })).toBeVisible();
});

test("selection mode appears on demand and bulk-moves cards to the trash", async ({ page }) => {
  const saved = await mockApi(page, [
    { ...base, id: "a", type: "note", title: "첫째 메모" },
    { ...base, id: "b", type: "note", title: "둘째 메모" },
  ]);
  await ready(page);
  await page.locator('[data-target="note"] button').click({ force: true });
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await expect(page.locator(".collection-check")).toHaveCount(0);
  await page.getByRole("button", { name: "선택", exact: true }).click();
  await page.getByLabel("첫째 메모 선택").check();
  await page.getByLabel("둘째 메모 선택").check();
  await page.getByRole("button", { name: "휴지통으로", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "2개를 휴지통으로" })).toBeVisible();
  expect(saved.filter((s) => s.deletedAt).map((s) => s.id).sort()).toEqual(["a", "b"]);
  await expect(page.locator(".tc-empty")).toBeVisible();
});

test("the calendar draws one continuous bar per week for a multi-day item and a dot when there is no due date", async ({
  page,
}) => {
  await mockApi(page, [
    { ...base, id: "long", type: "task", title: "긴 일정", startDate: dayKey(-1), dueDate: dayKey(5) },
    { ...base, id: "dot", type: "task", title: "마감 없는 일", startDate: dayKey(0) },
    { ...base, id: "note", type: "note", title: "노트는 막대가 없어요", startDate: dayKey(0) },
  ]);
  await ready(page);
  await page.locator('[data-target="calendar"] button').click({ force: true });
  await page.waitForTimeout(700);
  const long = page.locator(".calendar-bar", { hasText: "긴 일정" });
  const segments = await long.count();
  expect(segments).toBeGreaterThanOrEqual(1);
  expect(segments).toBeLessThanOrEqual(2); // at most one per week touched
  await expect(page.locator(".calendar-bar.is-dot", { hasText: "마감 없는 일" })).toHaveCount(1);
  await expect(page.locator(".calendar-bar", { hasText: "노트는 막대가 없어요" })).toHaveCount(0);
  // A bar is a real button that opens the item.
  await page.locator(".calendar-bar", { hasText: "마감 없는 일" }).click();
  await expect(page.locator(".detail-screen")).toBeVisible();
});

test("the calendar list under the month follows the selected day and widens on request", async ({ page }) => {
  await mockApi(page, [
    { ...base, id: "today", type: "task", title: "오늘 할 일", startDate: dayKey(0) },
    { ...base, id: "later", type: "task", title: "나중 할 일", startDate: dayKey(0 + 1) },
  ]);
  await ready(page);
  await page.locator('[data-target="calendar"] button').click({ force: true });
  const taskColumn = page.locator(".calendar-information-column.task");
  await expect(taskColumn).toContainText("오늘 할 일");
  await expect(taskColumn).not.toContainText("나중 할 일");
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await expect(taskColumn).toContainText("나중 할 일");
});

test("the detail screen shows a deadline card and the Todo's Task progress", async ({ page }) => {
  await mockApi(page, [
    {
      ...base,
      id: "p",
      type: "todo",
      title: "마감 있는 프로젝트",
      dueDate: dayKey(4),
      subtasks: [
        { id: "s1", title: "하나", completed: true, content: "", startDate: dayKey(0), dueDate: null },
        { id: "s2", title: "둘", completed: false, content: "", startDate: dayKey(0), dueDate: null },
      ],
    },
  ]);
  await ready(page);
  await page.locator('[data-target="todo"] button').click({ force: true });
  await page.locator(".collection-open").first().click();
  await expect(page.locator(".tc-deadline-card")).toContainText("마감까지 4일 남았어요");
  await expect(page.locator(".subtask-editor h2")).toContainText("1/2");
});

test("the calendar speaks Korean, weeks are only as tall as their bars, and +n sits level with the day number", async ({
  page,
}) => {
  const crowded = ["가", "나", "다", "라"].map((name) => ({
    ...base,
    id: `crowd-${name}`,
    type: "task",
    title: `${name} 일정`,
    startDate: dayKey(0),
    dueDate: dayKey(0),
  }));
  await mockApi(page, crowded);
  await ready(page);
  await page.locator('[data-target="calendar"] button').click({ force: true });
  await page.waitForTimeout(700);

  const now = new Date();
  await expect(page.locator(".tc-title h1")).toHaveText(`${now.getFullYear()}년 ${now.getMonth() + 1}월`);
  await expect(page.locator(".cm-weekdays")).toHaveText("월화수목금토일");

  const heights = await page.locator(".cm-week").evaluateAll((weeks) => weeks.map((w) => w.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));

  // Three lanes fit, so the fourth item is counted instead of drawn, level with the number.
  const more = page.locator(".cm-more");
  await expect(more).toHaveText("+1");
  const [moreBox, numBox] = await Promise.all([
    more.boundingBox(),
    page.locator(".cm-day.is-today .cm-num").boundingBox(),
  ]);
  expect(Math.abs(moreBox!.y + moreBox!.height / 2 - (numBox!.y + numBox!.height / 2))).toBeLessThan(2);

  // The chosen day is marked on its number only, not by tinting the whole cell.
  await expect(page.locator(".cm-day.is-selected .cm-num")).toHaveCSS("box-shadow", /rgb/);
});
