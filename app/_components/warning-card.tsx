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
  max,
}: {
  heading: string;
  items: readonly string[];
  /** Machine text (usernames as pasted) reads as monospace; Thai prose warnings do not. */
  mono?: boolean;
  /**
   * Cap how many bullets render. `heading` already carries the true count (`คำเตือน (${n})`), so
   * capping the list hides nothing — it only stops a long paste from pushing that count off
   * screen. Unset ⇒ render every item, exactly as before this prop existed.
   *
   * **Clamped to at least 1** (§2 rule 4 — this component *is* the surface that rule lands on).
   * A caller passing a computed budget can reach `max={0}` (a heading claiming n warnings above an
   * empty list) or a negative `max` (`slice(0, -5)` silently drops the *last* 5 and then reports
   * `n + 5` hidden — a count contradicting the list printed right above it). Neither may render.
   */
  max?: number;
}) {
  // One clamped limit drives both the slice and the count, so the two cannot disagree — and the
  // non-null assertion this used to need on the count line disappears with it.
  const limit = max === undefined ? items.length : Math.max(1, max);
  const shown = items.slice(0, limit);
  const hiddenCount = items.length - shown.length;
  const capped = hiddenCount > 0;
  return (
    <div className="card-warn flex flex-col gap-2">
      <p className="text-sm font-semibold text-amber-900">{heading}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {shown.map((text, i) => (
          <li key={i} className={mono ? "font-mono break-words" : "break-words"}>
            {text}
          </li>
        ))}
        {/* Thai prose, never monospace even when the list above is `mono` — this line is not
            machine text as pasted, it is a count. */}
        {capped && <li className="break-words">และอีก {hiddenCount} บรรทัด</li>}
      </ul>
    </div>
  );
}
