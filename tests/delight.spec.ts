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
};

async function mockApi(page: Page, seed: any[] = []) {
  let items = [...seed];
  await page.route("**/api/folders", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/items**", async (r) => {
    const req = r.request();
    if (req.method() === "POST") {
      const item = req.postDataJSON();
      items = [{ ...base, ...item, subtasks: [] }, ...items];
      await r.fulfill({ status: 201, json: { id: item.id } });
    } else if (req.method() === "PUT") {
      const item = req.postDataJSON();
      items = items.map((x) => (x.id === item.id ? { ...x, ...item } : x));
      await r.fulfill({ json: { ok: true } });
    } else await r.fulfill({ json: items });
  });
}
async function ready(page: Page, { intro = true } = {}) {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");
  // Calm mode bypasses the launch animation, so there is nothing to skip.
  if (intro) await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.locator(".startup")).toHaveCount(0);
  await page.waitForTimeout(700);
}
async function writeTitle(page: Page, title: string) {
  await page.locator(".memo-pad").getByRole("textbox", { name: "제목", exact: true }).fill(title);
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.waitForTimeout(450);
}

test("a swipe lights its destination as it progresses, then the memo lands with a burst and a badge", async ({
  page,
}) => {
  await mockApi(page);
  await ready(page);
  await expect(page.locator(".teo-companion")).toBeVisible();
  await writeTitle(page, "산책 예약");
  const handle = (await page.locator(".memo-handle").boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  const stage = page.locator(".home-stage");

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 36, y, { steps: 6 });
  await expect(stage).toHaveAttribute("data-swipe", "task");
  await expect(stage).not.toHaveAttribute("data-ready", /.*/);
  const partial = Number(await stage.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--swipe")));
  expect(partial).toBeGreaterThan(0.3);
  expect(partial).toBeLessThan(1);

  await page.mouse.move(x + 110, y, { steps: 8 });
  await expect(stage).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".teo-companion")).toHaveAttribute("data-mood", "happy");

  await page.mouse.up();
  await expect(page.getByRole("status").filter({ hasText: "등록되었습니다" })).toBeVisible();
  await expect(page.locator('[data-target="task"] .theo-count')).toHaveText("1");
  await expect(page.locator(".burst-layer .burst-piece").first()).toBeVisible();
  // The preview clears once the memo has landed.
  await expect(stage).not.toHaveAttribute("data-swipe", /.*/);
});

test("a swipe released short of the threshold springs back without celebrating", async ({
  page,
}) => {
  await mockApi(page);
  await ready(page);
  await writeTitle(page, "취소할 메모");
  const handle = (await page.locator(".memo-handle").boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 30, y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator(".home-stage")).not.toHaveAttribute("data-swipe", /.*/);
  await expect(page.locator(".burst")).toHaveCount(0);
  await expect(page.locator(".memo-title")).toHaveValue("취소할 메모");
});

test("petting TEO sends hearts and makes him cheer", async ({ page }) => {
  await mockApi(page);
  await ready(page);
  await page.getByRole("button", { name: "TEO 쓰다듬기" }).click();
  await expect(page.locator(".burst-layer .burst-piece").first()).toBeVisible();
  await expect(page.locator(".teo-companion")).toHaveAttribute("data-mood", "happy");
  // The cheer is short-lived.
  await expect(page.locator(".teo-companion")).toHaveAttribute("data-mood", "idle", { timeout: 4000 });
});

test("checking a task off celebrates and moves today's progress", async ({ page }) => {
  await mockApi(page, [
    { ...base, id: "k1", type: "task", title: "치과 예약 전화", startDate: dayKey(0) },
    { ...base, id: "k2", type: "task", title: "세금계산서 발행", startDate: dayKey(0) },
  ]);
  await ready(page);
  await expect(page.locator(".today-meter")).toContainText("오늘 0/2");
  await page.locator('[data-target="calendar"] button').click({ force: true });
  await page.getByLabel("치과 예약 전화 완료").first().click();
  await expect(page.locator(".burst-layer .burst-piece").first()).toBeVisible();
  await expect(page.getByLabel("치과 예약 전화 완료").first()).toBeChecked();
  await page.getByRole("button", { name: "캘린더 닫기" }).click();
  await expect(page.locator(".today-meter")).toContainText("오늘 1/2");
});

test("finishing everything due today gets a bigger celebration, once", async ({ page }) => {
  await mockApi(page, [
    { ...base, id: "k1", type: "task", title: "마지막 할 일", startDate: dayKey(0) },
  ]);
  await ready(page);
  await page.locator('[data-target="calendar"] button').click({ force: true });
  await page.getByLabel("마지막 할 일 완료").first().click();
  await page.getByRole("button", { name: "캘린더 닫기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "모두 끝냈어요" })).toBeVisible();
  await expect(page.locator(".today-meter")).toHaveClass(/is-complete/);
});

test("reduced motion keeps TEO still and skips the particles", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theo-quiet", "true"));
  await mockApi(page);
  await ready(page, { intro: false });
  await page.getByRole("button", { name: "TEO 쓰다듬기" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(".burst")).toHaveCount(0);
  await writeTitle(page, "조용한 메모");
  const handle = (await page.locator(".memo-handle").boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 110, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("status").filter({ hasText: "등록되었습니다" })).toBeVisible();
  await expect(page.locator(".burst")).toHaveCount(0);
  await expect(page.locator('[data-target="task"] .theo-count')).toHaveText("1");
});
