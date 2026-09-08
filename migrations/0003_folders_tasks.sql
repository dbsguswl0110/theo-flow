CREATE TABLE folders (name TEXT PRIMARY KEY, created_at TEXT NOT NULL);
ALTER TABLE items ADD COLUMN folder TEXT REFERENCES folders(name);
ALTER TABLE sub_todos ADD COLUMN content TEXT NOT NULL DEFAULT '';
ALTER TABLE sub_todos ADD COLUMN start_date TEXT;
ALTER TABLE sub_todos ADD COLUMN due_date TEXT;
