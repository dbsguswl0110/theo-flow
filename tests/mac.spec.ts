import { test, expect, type Page } from "@playwright/test";

// The Mac app's web view adds "TEOFlowMac" to the user agent; that is the whole switch.
test.use({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) TEOFlowMac",
  viewport: { width: 1100, height: 760 },
});

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
  const created: any[] = [];
  await page.route("**/api/folders", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/items**", async (r) => {
    const req = r.request();
    if (req.method() === "POST") {
      const item = req.postDataJSON();
      created.push(item);
      items = [{ ...base, ...item, subtasks: [] }, ...items];
      await r.fulfill({ status: 201, json: { id: item.id } });
    } else if (req.method() === "PUT") {
      const item = req.postDataJSON();
      items = items.map((x) => (x.id === item.id ? { ...x, ...item } : x));
      await r.fulfill({ json: { ok: true } });
    } else await r.fulfill({ json: items });
  });
  return created;
}

const tab = (page: Page, name: string) => page.locator(".mac-tabs").getByRole("button", { name, exact: true });

test("the Mac app opens on the calendar: no swipe pad, no launch animation, a tab for every screen", async ({ page }) => {
  await mockApi(page, [
    { ...base, id: "t1", type: "task", title: "견적서 보내기", dueDate: dayKey(2) },
    { ...base, id: "n1", type: "note", title: "회의 아이디어" },
  ]);
  await page.goto("/");
  await expect(page.locator(".calendar-screen")).toBeVisible();
  // It is there at once, not zooming in from an icon.
  expect(await page.locator(".calendar-screen").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(page.locator(".startup")).toHaveCount(0);
  // The pad, TEO's four targets and the phone's Trash/Setting buttons are not on this screen.
  await expect(page.locator(".memo-pad")).toHaveCount(0);
  await expect(page.locator("[data-target]")).toHaveCount(0);
  await expect(page.locator(".utility-bar")).toHaveCount(0);
  // One bar of tabs, the calendar being the one that is open.
  await expect(page.locator(".mac-tabs").getByRole("button")).toHaveText([
    "캘린더",
    "Note",
    "Task",
    "Todo",
    "Trash",
    "Setting",
    "새 메모",
  ]);
  await expect(tab(page, "캘린더")).toHaveAttribute("aria-current", "page");
  // Tabs are the way around, so the calendar has no back arrow.
  await expect(page.locator(".calendar-screen .tc-back")).toHaveCount(0);
  // The screen sits under the bar, not behind it.
  const bar = (await page.locator(".mac-tabs").boundingBox())!;
  const screen = (await page.locator(".calendar-screen").boundingBox())!;
  expect(screen.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  await expect(page.locator(".calendar-screen .cm-today, .calendar-screen [aria-current='date']").first()).toBeVisible();
});

test("tabs switch screens, the list screens have no back arrow, and a detail goes back to its list", async ({ page }) => {
  await mockApi(page, [
    { ...base, id: "n1", type: "note", title: "회의 아이디어" },
    { ...base, id: "t1", type: "task", title: "견적서 보내기", dueDate: dayKey(2) },
  ]);
  await page.goto("/");
  await tab(page, "Note").click();
  await expect(page.locator(".collection-panel.tone-note")).toBeVisible();
  await expect(tab(page, "Note")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "캘린더")).not.toHaveAttribute("aria-current", "page");
  await expect(page.locator(".collection-panel .tc-back")).toHaveCount(0);

  await page.locator(".collection-panel").getByText("회의 아이디어", { exact: true }).click();
  await expect(page.locator(".tc-back")).toHaveCount(1);
  await page.locator(".tc-back").click();
  await expect(page.locator(".collection-panel.tone-note")).toBeVisible();
  await expect(tab(page, "Note")).toHaveAttribute("aria-current", "page");

  await tab(page, "Task").click();
  await expect(page.locator(".collection-panel.tone-task")).toBeVisible();
  await tab(page, "Setting").click();
  await expect(page.locator(".settings-panel")).toBeVisible();
  await expect(page.locator(".settings-panel .tc-back")).toHaveCount(0);
  // The phone's way of writing is not described where it cannot be used.
  await expect(page.locator(".settings-panel")).not.toContainText("메모지를 위로 밀면");
  await tab(page, "캘린더").click();
  await expect(page.locator(".calendar-screen")).toBeVisible();
});

test("새 메모 opens a ready-to-write Note, and Task and Todo have their own new buttons", async ({ page }) => {
  const created = await mockApi(page, []);
  await page.goto("/");
  await page.locator(".mac-tabs").getByRole("button", { name: "새 메모" }).click();
  await expect(page.locator(".collection-panel.tone-note")).toBeVisible();
  await expect(page.locator(".inline-composer .memo-title")).toBeFocused();
  await page.locator(".inline-composer .memo-title").fill("맥에서 쓴 메모");
  await page.locator(".inline-composer").getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".collection-card")).toContainText("맥에서 쓴 메모");
  expect(created.map((c) => [c.type, c.title])).toEqual([["note", "맥에서 쓴 메모"]]);

  // Pressing it again while on Note opens the composer again instead of doing nothing.
  await page.locator(".mac-tabs").getByRole("button", { name: "새 메모" }).click();
  await expect(page.locator(".inline-composer")).toBeVisible();

  // An empty list points at its button, not at a swipe.
  await tab(page, "Todo").click();
  await expect(page.locator(".tc-empty")).toContainText("새 Todo");
  await page.getByRole("button", { name: "새 Todo" }).click();
  await page.locator(".inline-composer .memo-title").fill("이사 준비");
  await page.locator(".inline-composer").getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".collection-card")).toContainText("이사 준비");
  expect(created.map((c) => c.type)).toEqual(["note", "todo"]);
});

test("a widget link in the Mac app still lands on the right tab", async ({ page }) => {
  await mockApi(page, []);
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("theo-widget-open", { detail: "task" })));
  await expect(page.locator(".collection-panel.tone-task")).toBeVisible();
  await expect(tab(page, "Task")).toHaveAttribute("aria-current", "page");
});
