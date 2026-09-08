export type ItemType = "note" | "task" | "todo";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type CaptureItem = {
  id: string;
  type: ItemType;
  title: string;
  content: string;
  startDate: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  photos?: (string | { id: string; fileName?: string; file_name?: string })[];
  subtasks?: Subtask[];
};

export type DraftItem = {
  title: string;
  content: string;
  startDate: string;
  dueDate: string | null;
};
