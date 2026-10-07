import { PlusIcon } from "./ui";

const TABS: Array<[screen: string, label: string]> = [
  ["calendar", "캘린더"],
  ["note", "Note"],
  ["task", "Task"],
  ["todo", "Todo"],
  ["trash", "Trash"],
  ["settings", "Setting"],
];

/** The Mac app's menu: every screen one click away, and a button to write a new memo. */
export default function MacTabs({
  screen,
  onOpen,
  onCompose,
}: {
  screen: string;
  onOpen: (screen: string) => void;
  onCompose: () => void;
}) {
  return (
    <nav className="mac-tabs" aria-label="메뉴">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="mac-tab"
          aria-current={screen === id ? "page" : undefined}
          onClick={() => onOpen(id)}
        >
          {label}
        </button>
      ))}
      <button type="button" className="mac-new" onClick={onCompose}>
        <PlusIcon />새 메모
      </button>
    </nav>
  );
}
