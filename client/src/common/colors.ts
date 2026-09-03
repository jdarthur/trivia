/**
 * Color palettes for the two places the app assigns a color to a name.
 *
 * They used to be one list. They are now two, because the two jobs have
 * conflicting requirements and sharing a list was the bug:
 *
 * - Bucket tags (TAG_COLORS) render white text on the color, so every entry
 *   must stay dark — antd level-7/8, ≥4.5:1 against white. Buckets are
 *   assigned by hash, so which entry a bucket gets is irrelevant; all that
 *   matters is that the same bucket always hashes to the same color.
 * - Team lines (TEAM_COLORS) are drawn on a white background and have to be
 *   told apart from each other at a glance, in rank order. Contrast against
 *   white only needs the ~3:1 WCAG non-text minimum, so they can use the
 *   mid-lightness band the tag palette has to avoid.
 *
 * Keeping them together forced the team palette into the narrow dark band that
 * white text allows, where there is not nearly enough room to tell 11 (let
 * alone 20) colors apart — and the old list walked the hue wheel, so the
 * leader and runner-up got adjacent hues. Red (#a8071a) vs volcano (#ad2e24)
 * measured ΔE 8.8, well inside "these are the same color".
 */

/**
 * Bucket tag colors: dark shades (antd level-7/8, relative luminance ≤ ~0.14)
 * so white tag text stays readable — antd renders white text for a custom hex
 * on the "solid" variant, and every color here keeps ≥5.4:1 against it. Gold
 * and lime use their darker level-8 shade to clear the 4.5:1 bar.
 */
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

/**
 * Team line colors, in assignment order: leader first.
 *
 * The first 11 entries are one per antd hue family, ordered so that any prefix
 * of the list is maximally spread through Lab space — a 3-team game gets three
 * hues as far apart as the family set allows, not red and its two neighbours.
 * Entries 12-20 repeat nine of those families (gold and lime only had one
 * shade that clears the contrast floor) at a *different* lightness, in the same
 * family order, so a large game still reads and the tail degrades to
 * same-hue-different-lightness rather than to a straight repeat.
 *
 * Order and levels were chosen by search (greedy farthest-point over the
 * family/level options), scored on min pairwise ΔE of every prefix with a
 * protanopia/deuteranopia/tritanopia penalty, then frozen here as a literal so
 * the assignment is deterministic and diffable. Measured against the old list,
 * worst-case separation among the teams on screen:
 *
 *   teams    2      3      5      8      11
 *   old     8.8    8.8    8.8    8.8    8.8
 *   new   165.2   64.4   56.5   29.9   15.5
 *
 * Every entry keeps ≥3:1 against white, the WCAG non-text minimum, so a 2px
 * line stays legible; several go well past it.
 */
export const TEAM_COLORS = [
    "#531dab", // purple-7
    "#389e0d", // green-7
    "#f759ab", // magenta-6
    "#a8071a", // red-8
    "#006d75", // cyan-8
    "#597ef7", // geekblue-6
    "#fa541c", // volcano-6
    "#ad4e00", // orange-8
    "#0958d9", // blue-7
    "#ad6800", // gold-8
    "#5b8c00", // lime-8
    "#391085", // purple-8
    "#237804", // green-8
    "#9e1068", // magenta-8
    "#f5222d", // red-6
    "#08979c", // cyan-7
    "#1d39c4", // geekblue-7
    "#ad2102", // volcano-8
    "#d46b08", // orange-7
    "#003eb3", // blue-8
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
 * legend (ticket #235): TEAM_COLORS by position over an already-ordered list of
 * team names. Up to TEAM_COLORS.length teams every line gets its own color;
 * past that the palette wraps and colors repeat, since a finite palette has
 * nothing left to give.
 *
 * The input MUST be ordered with the same comparator the scoreboard uses —
 * total score descending, then team name ascending (see Scoreboard.render) —
 * because the palette is ordered by distinctness, not by hue. The leader gets
 * the anchor color and each subsequent rank gets the color most different from
 * every color already handed out, which is only meaningful if ranks arrive in
 * order. Ordering is the caller's job because only the caller has the
 * standings.
 */
export function teamColors(orderedTeamNames: string[]): Record<string, string> {
    const colors: Record<string, string> = {}
    const n = TEAM_COLORS.length
    orderedTeamNames.forEach((name, i) => {
        colors[name] = TEAM_COLORS[i % n]
    })
    return colors
}
