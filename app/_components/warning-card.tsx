/**
 * What the system could not decide — shown, never swallowed (CLAUDE.md §2 rule 4).
 *
 * Lives in `app/_components/` rather than beside one screen because two screens raise the same
 * shape of warning from different data: the payslip detail lists what `computePayslip` refused to
 * guess, and the `/ot` paste form lists the usernames that matched nobody. The card, the heading
 * and the bullet list were duplicated verbatim in both before task 009's review; the *data* keeps
 * its separate homes, only the markup is shared.
 */
export function WarningCard({
  heading,
  items,
  mono = false,
}: {
  heading: string;
  items: readonly string[];
  /** Machine text (usernames as pasted) reads as monospace; Thai prose warnings do not. */
  mono?: boolean;
}) {
  return (
    <div className="card-warn flex flex-col gap-2">
      <p className="text-sm font-semibold text-amber-900">{heading}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-800">
        {items.map((text, i) => (
          <li key={i} className={mono ? "font-mono break-words" : "break-words"}>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
