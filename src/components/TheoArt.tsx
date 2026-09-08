export type TheoKind = "note" | "task" | "todo" | "project" | "calendar";
// Preserve the supplied artwork's proportions and isolate each icon from its sheet.
const views: Record<TheoKind, string> = {
  todo: "128 332 128 132",
  task: "447 327 130 140",
  calendar: "769 327 160 140",
  note: "1092 327 135 140",
  project: "1416 327 145 140",
};
export default function TheoArt({
  kind,
  face = false,
}: {
  kind: TheoKind;
  face?: boolean;
}) {
  return (
    <svg
      className="theo-art"
      viewBox={face ? "40 898 95 82" : views[kind]}
      aria-hidden="true"
    >
      <image
        href={
          face ? "/assets/theo-character.png" : "/assets/theo-navigation.png"
        }
        width={face ? 1536 : 1672}
        height={face ? 1024 : 941}
      />
    </svg>
  );
}
