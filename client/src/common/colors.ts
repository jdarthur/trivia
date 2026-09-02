// Tag background colors shared by the bucketing answer key and the score
// graph's per-team line/legend colors (ticket #235). All are dark shades
// (antd level-7/8, relative luminance ≤ ~0.14 — well under 50% brightness) so
// white tag text stays readable: antd renders white text for a custom hex
// color on the "solid" variant, and every color here keeps ≥5.4:1 contrast
// against it. Gold/lime use their darker level-8 shade to clear the 4.5:1 bar.
// On the score graph the roles invert (dark strokes/dots on a white
// background), which keeps the lightest entries here comfortably visible.
export const TAG_COLORS = [
    "#a8071a", // red
    "#ad2e24", // volcano
    "#ad4e00", // orange
    "#874d00", // gold
    "#3f6600", // lime
    "#237804", // green
    "#006d75", // cyan
    "#0050b3", // blue
    "#10239e", // geekblue
    "#391085", // purple
    "#9e1068", // magenta
]

// Bucket color: one per bucket via a stable hash so the same bucket always
// gets the same color across re-renders (no flicker). Hashing is right for
// buckets (unordered, arbitrary labels) but wrong for teams — see teamColors.
export function bucketColor(bucket: string): string {
    let hash = 0
    for (let i = 0; i < bucket.length; i++) {
        hash = (hash * 31 + bucket.charCodeAt(i)) >>> 0
    }
    return TAG_COLORS[hash % TAG_COLORS.length]
}

/**
 * Deterministic, unique-per-team colors for the score line-graph's lines and
 * legend (ticket #235). Assigns palette entries by position over an
 * already-ordered list of team names, cycling with
 * `(i + floor(i / TAG_COLORS.length)) % TAG_COLORS.length` so the assignment
 * stays unique past 11 teams instead of colliding.
 *
 * The input MUST be ordered with the same comparator the scoreboard uses —
 * total score descending, then team name ascending (see Scoreboard.render) —
 * so the leader's line gets a predictable hue and the assignment stays stable
 * as long as the standings don't change. Ordering is the caller's job because
 * only the caller has the standings.
 */
export function teamColors(orderedTeamNames: string[]): Record<string, string> {
    const colors: Record<string, string> = {}
    orderedTeamNames.forEach((name, i) => {
        colors[name] = TAG_COLORS[(i + Math.floor(i / TAG_COLORS.length)) % TAG_COLORS.length]
    })
    return colors
}
