import type { CaptureItem } from "../types";

const KEY = "teo-flow-items";

function normalise(raw: any[]): CaptureItem[] {
  return raw.map((item) => ({
    ...item,
    startDate: item.startDate ?? item.start_date ?? "",
    dueDate: item.dueDate ?? item.due_date ?? null,
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
    subtasks: item.subtasks ?? item.subTodos ?? []
  }));
}

export function loadItems(): CaptureItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function loadItemsRemote(): Promise<CaptureItem[] | null> {
  try {
    const response = await fetch("/api/items", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return normalise(await response.json());
  } catch { return null; }
}

export async function createItemRemote(item: CaptureItem): Promise<boolean> {
  try {
    const response = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      id: item.id, type: item.type, title: item.title, content: item.content, startDate: item.startDate, dueDate: item.dueDate,
      subTodos: (item.subtasks ?? []).map((subtask) => subtask.title)
    }) });
    return response.ok;
  } catch { return false; }
}

export async function updateItemRemote(item: CaptureItem): Promise<boolean> {
  try {
    const response = await fetch(`/api/items/${item.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
    return response.ok;
  } catch { return false; }
}

export async function uploadPhotoRemote(itemId: string, file: File) {
  const form = new FormData(); form.append("photo", file);
  const response = await fetch(`/api/items/${itemId}/photos`, { method: "POST", body: form });
  if (!response.ok) throw new Error("Photo upload failed");
  return response.json() as Promise<{ id: string; fileName: string }>;
}

export async function deletePhotoRemote(photoId: string) {
  const response = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Photo delete failed");
}

export function saveItems(items: CaptureItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}
