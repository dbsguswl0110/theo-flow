import { motion } from "framer-motion";
import { ScreenHeader, Switch } from "./ui";
import { feedback } from "../lib/feedback";
import { isMacApp } from "../lib/platform";

type Prefs = { haptics: boolean; sound: boolean };

export default function Settings({
  layout,
  onLayout,
  quiet,
  onQuiet,
  prefs,
  onPrefs,
  sync,
  onBack,
}: {
  layout: string;
  onLayout: (layout: string) => void;
  quiet: boolean;
  onQuiet: (quiet: boolean) => void;
  prefs: Prefs;
  onPrefs: (prefs: Prefs) => void;
  sync: string;
  onBack?: () => void;
}) {
  return (
    <motion.section
      className="panel tc-screen settings-panel"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, pointerEvents: "none" as const, transition: { duration: 0.18, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <ScreenHeader
        title="Setting"
        subtitle="TEO와 앱을 내 취향에 맞춰요"
        tone="settings"
        backLabel="설정 닫기"
        onBack={onBack}
      />

      <section className="tc-card tc-group">
        <h2>화면</h2>
        <label className="tc-field">
          <span>
            <strong>화면 배치</strong>
            <small>접힌 화면과 펼친 화면에 맞춰 자리를 잡아요</small>
          </span>
          <select value={layout} onChange={(e) => onLayout(e.target.value)}>
            <option value="auto">화면에 맞게 자동</option>
            <option value="folded">접힌 화면 · 십자형</option>
            <option value="expanded">펼친 화면 · 넓은 십자형</option>
          </select>
        </label>
        <Switch
          label="움직임 줄이기"
          hint="TEO가 가만히 있고 폭죽과 효과가 사라져요"
          checked={quiet}
          onChange={onQuiet}
        />
      </section>

      <section className="tc-card tc-group">
        <h2>느낌</h2>
        <Switch
          label="진동 피드백"
          hint="메모가 도착하거나 체크할 때 톡 울려요"
          checked={prefs.haptics}
          onChange={(haptics) => {
            onPrefs({ ...prefs, haptics });
            if (haptics) feedback.pet();
          }}
        />
        <Switch
          label="효과음"
          hint="짧고 작은 소리로 알려줘요"
          checked={prefs.sound}
          onChange={(sound) => {
            onPrefs({ ...prefs, sound });
            if (sound) feedback.pet();
          }}
        />
      </section>

      <section className="tc-card tc-group">
        <h2>이렇게 쓰면 돼요</h2>
        <ul className="tc-tips">
          <li>
            <b>Todo</b>는 프로젝트예요. 안에 <b>Task</b>를 하나씩 추가해 쪼개요.
          </li>
          <li>캘린더에는 Todo와 Task가 막대로 그려져요.</li>
          <li>
            <b>Note</b>는 달력 옆 목록에서 보고, 폴더로 나눌 수 있어요.
          </li>
          {!isMacApp && <li>메모지를 위로 밀면 Todo, 왼쪽은 Note, 오른쪽은 Task가 돼요.</li>}
        </ul>
        <p className="tc-status">
          <i aria-hidden="true" />
          데이터 상태: {sync}
        </p>
      </section>
    </motion.section>
  );
}
