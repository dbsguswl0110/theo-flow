export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const emptyDraft = () => ({
  title: "",
  content: "",
  startDate: dayKey(),
  dueDate: null as string | null,
});
