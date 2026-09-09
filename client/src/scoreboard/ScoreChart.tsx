import React, {useRef, useState} from 'react';
import "./ScoreChart.css"

/**
 * ScoreChart — a dependency-free SVG line graph of cumulative score per team
 * over the questions of a game (ticket #236, part of #233).
 *
 * Purely presentational: it takes an x-axis of question labels and one series
 * per team, and draws. No fetching (the modal owns that, #237); the legend and
 * PNG export live in the modal too (#238, #240) — the chart itself only draws.
 *
 * Point detail (ticket #238) is drawn here because it needs the geometry:
 * every dot gets an enlarged invisible hit circle, and hovering/tapping one
 * shows a positioned overlay with the team, question label, points awarded for
 * that question and the running total. Click-to-isolate (dim every line but
 * the picked team's) is a prop so the legend in the modal can drive it.
 *
 * It sizes itself with `viewBox` + `preserveAspectRatio` and `width: 100%`
 * (see ScoreChart.css), so it fills its container and keeps its aspect ratio.
 * Because the whole drawing — including axis text — is in viewBox units, text
 * scales with the container: `width`/`height` are the coordinate space, not
 * pixels. Pass a viewBox close to the container's CSS pixel width if you want
 * axis labels to land at their nominal size (a 360px-wide modal looks better
 * with width={400} than width={800}).
 */

export interface Series {
    name: string
    color: string
    values: number[]
    /** Team icon name, for the modal's legend (ticket #238). */
    icon?: string
    /** Whether the team is still in the game; inactive teams are dimmed in the legend. */
    active?: boolean
}

interface Props {
    /** Question labels, e.g. ["R1Q1", "R1Q2", ...] from the score-history API. */
    axis: string[]
    series: Series[]
    width?: number
    height?: number
    /**
     * Click-to-isolate (ticket #238): when set to a team name, every other
     * line fades to a ghost. null/undefined leaves all lines full strength.
     */
    isolated?: string | null
    /**
     * The <svg> node, handed to the caller for rasterizing (ticket #240).
     * Stays null in the empty state — there is nothing to export then, and a
     * caller should disable its button rather than fail.
     */
    svgRef?: React.Ref<SVGSVGElement>
}

const TARGET_TICKS = 5

// Rough advance width of a digit or capital letter in the chart's sans font,
// as a fraction of the font size. Labels are thinned with this estimate rather
// than measured, since measuring needs a layout pass; overestimating slightly
// is safe — it just drops a label rather than letting two overlap.
const CHAR_W = 0.62

// Inner padding in viewBox units. Left is sized to the widest y label (see the
// component body) so big scores can't clip; the bottom reserves a row for x
// labels plus a row for round labels. Everything is derived from the viewBox so
// a caller passing a phone-sized one doesn't get a plot that is mostly margin.
function margins(width: number, height: number, leftForLabels: number) {
    return {
        top: Math.round(Math.min(20, Math.max(10, height * 0.04))),
        right: Math.round(Math.min(20, Math.max(10, width * 0.02))),
        bottom: Math.round(Math.min(56, Math.max(30, height * 0.12))),
        left: Math.round(Math.min(width * 0.3, Math.max(28, leftForLabels))),
    }
}

// Question labels look like "R2Q7"; the round number is what boundaries are
// drawn between. Labels that don't match (a hand-made axis) simply get no
// dividers rather than throwing.
function roundOf(label: string): number | null {
    const m = /^R(\d+)/i.exec(label)
    return m ? parseInt(m[1], 10) : null
}

// "Nice" axis step: the smallest 1/2/5 x 10^n that is >= raw.
function niceStep(raw: number): number {
    if (!(raw > 0) || !isFinite(raw)) return 1
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    const frac = raw / mag
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10
    return nice * mag
}

/**
 * Y domain plus the tick values inside it. Always contains 0 (a Moneyball miss
 * is -1X, so a team can finish below zero and the zero line has to be visible),
 * and never collapses to a single value: an all-equal game gets padded out so
 * its line sits in the middle of the plot instead of on an axis edge.
 */
function yScale(dataMin: number, dataMax: number) {
    let min = Math.min(0, dataMin)
    let max = Math.max(0, dataMax)
    if (min === max) {
        min = min - 1
        max = max + 1
    }
    const step = niceStep((max - min) / (TARGET_TICKS - 1))
    const lo = Math.floor(min / step) * step
    const hi = Math.ceil(max / step) * step
    const ticks: number[] = []
    // Accumulating lo + i*step over an integer count avoids the float drift
    // that repeated += would show up in a label ("119.99999999999999").
    for (let i = 0; lo + i * step <= hi + step / 1e6; i++) ticks.push(lo + i * step)
    return {min: lo, max: hi, ticks}
}

// Scores can be fractional, so labels are decimals; rounded so float sums
// don't print as "119.99999999999999", and never in exponent form.
function fmtTick(v: number): string {
    return String(Math.round(v * 100) / 100)
}

// Per-question points for the tooltip: signed, so a Moneyball miss reads as
// "-10" and a gain as "+10" (0 stays unsigned).
function fmtPts(v: number): string {
    const n = Math.round(v * 100) / 100
    return n > 0 ? "+" + n : String(n)
}

const ScoreChart: React.FC<Props> = ({axis, series, width = 800, height = 400, isolated = null, svgRef}) => {
    // The tooltip overlay is positioned from the hovered dot's viewBox
    // coordinates scaled by the rendered size (the wrapper's clientWidth over
    // the viewBox width; with `width: 100%` + `height: auto` the aspect ratio
    // matches, so one scale serves both axes).
    const wrapRef = useRef<HTMLDivElement>(null)
    const tipRef = useRef<HTMLDivElement>(null)
    // hover is an index into `drawn` plus a point index; null = no tooltip.
    const [hover, setHover] = useState<{s: number, i: number} | null>(null)

    // Axis type scales with the coordinate space rather than being a fixed 12px
    // inside an 800-unit viewBox. Note that under `width: 100%` + preserveAspect-
    // Ratio everything in the SVG — text included — scales with the container, so
    // for axis labels to land at their nominal size the caller should pass a
    // `width` close to the container's CSS pixel width (see the component doc).
    const tickFont = Math.min(16, Math.max(10, Math.round(width * 0.015)))
    const roundFont = Math.max(9, tickFont - 1)

    const points = axis?.length ?? 0
    // Only series with at least one drawable number count: an all-empty series
    // draws nothing and would inflate the aria-label's team count.
    const drawn = (series ?? []).filter(s => s && s.values && s.values.length > 0)
    const teamCount = drawn.length

    if (points === 0 || teamCount === 0) {
        return (
            <div className="score-chart score-chart-empty" role="img"
                 aria-label="No score data yet">
                <span>No scores yet</span>
            </div>
        )
    }

    // A series may be shorter than the axis (or longer); only the overlap is
    // drawn, so a ragged payload can't run a line off the plot.
    const valueAt = (values: number[], i: number) => {
        const v = values[i]
        return Number.isFinite(v) ? v : 0
    }

    let dataMin = Infinity
    let dataMax = -Infinity
    for (const s of drawn) {
        for (let i = 0; i < points; i++) {
            const v = valueAt(s.values, i)
            if (v < dataMin) dataMin = v
            if (v > dataMax) dataMax = v
        }
    }
    if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
        dataMin = 0
        dataMax = 0
    }

    const {min, max, ticks} = yScale(dataMin, dataMax)
    const span = max - min

    // Wide scores ("-120", "1440") get a wider gutter rather than clipping.
    const widestTick = ticks.reduce((a, t) => Math.max(a, fmtTick(t).length), 1)
    const M = margins(width, height, widestTick * tickFont * CHAR_W + 10)
    const plotW = Math.max(10, width - M.left - M.right)
    const plotH = Math.max(10, height - M.top - M.bottom)

    // One x slot per question. With a single point there is no interval to
    // divide, so center it (a zero-width domain would drop it on the y axis).
    const x = (i: number) => points === 1
        ? M.left + plotW / 2
        : M.left + (i / (points - 1)) * plotW
    const y = (v: number) => M.top + (1 - (v - min) / span) * plotH

    // Round boundaries: one entry per run of consecutive questions sharing a
    // round, carrying the divider x (midway to the previous question, i.e. the
    // left edge of the run) and the run's index span, so a line's shape can be
    // read per round and each round's label can be centered over its questions.
    const rounds: {round: number, dividerX: number, first: number, last: number}[] = []
    for (let i = 0; i < points; i++) {
        const r = roundOf(axis[i])
        if (r === null) continue
        const prev = rounds[rounds.length - 1]
        if (prev && prev.round === r) {
            prev.last = i
            continue
        }
        rounds.push({round: r, dividerX: i === 0 ? M.left : (x(i) + x(i - 1)) / 2, first: i, last: i})
    }

    // X labels, thinned so they never overlap. Every `stride`-th question is a
    // candidate; placement is greedy left-to-right on estimated text boxes, and
    // the final question is always anchored — if it lands on its neighbour, the
    // neighbour is dropped instead (the end of the game matters more than a
    // label in the middle).
    // `?? ""` guards a sparse axis array (a hole yields undefined), which would
    // otherwise throw here and take the scoreboard down with it.
    const labelWidth = (text: string) => (text ?? "").length * tickFont * CHAR_W
    const labelGap = Math.round(tickFont * 0.6)
    const stride = Math.max(1, Math.ceil((points * (labelWidth(axis[0]) + labelGap)) / plotW))
    const xLabels: {x: number, text: string}[] = []
    const pushLabel = (i: number, anchorEnd: boolean) => {
        const text = axis[i]
        const half = labelWidth(text) / 2
        // Clamp so an edge label can't hang off the viewBox.
        const lx = Math.min(width - half - 2, Math.max(half + 2, x(i)))
        const prev = xLabels[xLabels.length - 1]
        if (prev) {
            const prevHalf = labelWidth(prev.text) / 2
            const overlap = (prev.x + prevHalf + labelGap) - (lx - half)
            if (overlap > 0) {
                // The end-of-game label wins its slot; anything else is dropped.
                if (!anchorEnd) return
                xLabels.pop()
            }
        }
        xLabels.push({x: lx, text})
    }
    for (let i = 0; i < points; i += stride) pushLabel(i, false)
    if ((points - 1) % stride !== 0) pushLabel(points - 1, true)

    // Round labels are only legible when a row of them fits; past that the
    // dividers alone still mark the boundaries.
    const showRoundLabels = rounds.length > 0
        && rounds.length * (labelWidth("R99") + labelGap) <= plotW

    const zeroLine = min < 0 && max > 0
        ? <line className="score-chart-zero" x1={M.left} x2={M.left + plotW}
                y1={y(0)} y2={y(0)}/>
        : null

    // Dots shrink as the game gets long: they mark single-question jumps and
    // give hover/tap (ticket #238) a hit target, but 60 questions of 3px dots
    // would read as a bead necklace.
    const dotR = points > 48 ? 1.8 : points > 24 ? 2.4 : 3
    // The visible dot is small, so the invisible hit circle around it stays
    // comfortably tappable no matter how long the game (ticket #238).
    const hitR = Math.max(11, dotR + 8)

    const lines = drawn.map((s, seriesIndex) => {
        const pts: string[] = []
        for (let i = 0; i < points; i++) pts.push(`${x(i)},${y(valueAt(s.values, i))}`)
        // Click-to-isolate (ticket #238): everything except the picked team
        // fades; the picked team's dots still hover/tooltip like normal.
        const dimmed = isolated != null && s.name !== isolated
        return (
            // A single point has no segment to draw — a zero-length polyline
            // renders as nothing (and with round caps can flash a blob), so it
            // gets the dot alone.
            // Keyed by index, not team name: two teams can share a display name
            // (the API has no uniqueness constraint on it), and React needs the
            // keys unique. Series order is stable from the score-history API.
            <g key={seriesIndex}
               className={"score-chart-series" + (dimmed ? " score-chart-dimmed" : "")}
               data-team={s.name}>
                {points > 1
                    ? <polyline className="score-chart-line" fill="none" stroke={s.color}
                                strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')}/>
                    : null}
                {Array.from({length: points}, (_, i) => {
                    const cx = x(i)
                    const cy = y(valueAt(s.values, i))
                    const label = axis[i] ?? ""
                    return (
                        // The visible dot is decorative (pointer-events: none in
                        // the CSS) so the enlarged transparent hit circle under
                        // it owns the hover/tap target: a comfortable touch area
                        // even where the dot itself is 1.8px (ticket #238).
                        <g key={i}>
                            <circle className="score-chart-hit" cx={cx} cy={cy} r={hitR}
                                    role="img"
                                    aria-label={`${s.name}, ${label}, ${fmtTick(valueAt(s.values, i))} total`}
                                    onMouseEnter={() => setHover({s: seriesIndex, i})}
                                    onMouseLeave={() => setHover(h => h && h.s === seriesIndex && h.i === i ? null : h)}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setHover({s: seriesIndex, i})
                                    }}/>
                            <circle className="score-chart-dot" cx={cx} cy={cy} r={dotR} fill={s.color}/>
                        </g>
                    )
                })}
            </g>
        )
    })

    // The tooltip for the hovered point. Computed from the same x()/y() the
    // dots are drawn at, then scaled by the SVG's rendered size (see the note
    // by wrapRef). Points awarded = the step from the previous cumulative
    // value, so the tooltip reads like the score history ("+10 on R2Q3").
    const tooltip = (() => {
        if (!hover) return null
        const s = drawn[hover.s]
        if (!s || hover.i >= points) return null
        const v = valueAt(s.values, hover.i)
        const prev = hover.i === 0 ? 0 : valueAt(s.values, hover.i - 1)
        const label = axis[hover.i] ?? ""
        const wrap = wrapRef.current
        const scale = wrap && wrap.clientWidth > 0 ? wrap.clientWidth / width : 1
        const px = x(hover.i) * scale
        const py = y(v) * scale
        // The tooltip's own size is measured once it has rendered; the
        // fallbacks cover the very first frame so placement is stable.
        const tip = tipRef.current
        const tipW = tip?.offsetWidth ?? 180
        const tipH = tip?.offsetHeight ?? 84
        const wrapW = wrap?.clientWidth ?? width
        const left = Math.max(tipW / 2 + 4, Math.min(wrapW - tipW / 2 - 4, px))
        const above = py - tipH - 10 >= 4
        const top = above ? py - tipH - 10 : py + 14
        const pointsWord = v - prev === 1 || v - prev === -1 ? "pt" : "pts"
        return (
            <div className="score-chart-tooltip" ref={tipRef} style={{left, top}}>
                <span className="score-chart-tooltip-team">
                    <span className="score-chart-tooltip-dot" style={{background: s.color}}/>
                    {s.name}
                </span>
                <span className="score-chart-tooltip-line">{label}</span>
                <span className="score-chart-tooltip-line">
                    {fmtPts(v - prev)} {pointsWord} · {fmtTick(v)} total
                </span>
            </div>
        )
    })()

    const questionWord = points === 1 ? "question" : "questions"
    const teamWord = teamCount === 1 ? "team" : "teams"

    return (
        // The wrapper is the positioning context for the tooltip overlay and
        // the reference for scaling viewBox coords to pixels. Clicking the
        // chart's dead space dismisses the tooltip (a tap-away on touch);
        // the hit circles stopPropagation so tapping a dot keeps it.
        <div className="score-chart-wrap" ref={wrapRef}
             onClick={() => setHover(null)}
             onMouseLeave={() => setHover(null)}>
            <svg className="score-chart" viewBox={`0 0 ${width} ${height}`}
                 preserveAspectRatio="xMidYMid meet" role="img" ref={svgRef}
                 aria-label={`Score progression over ${points} ${questionWord}; ${teamCount} ${teamWord}`}>
                {ticks.map((t, i) => (
                    <g key={i}>
                        <line className="score-chart-grid" x1={M.left} x2={M.left + plotW}
                              y1={y(t)} y2={y(t)}/>
                        <text className="score-chart-y-label" x={M.left - 8} y={y(t)}
                              textAnchor="end" dominantBaseline="middle"
                              style={{fontSize: tickFont}}>{fmtTick(t)}</text>
                    </g>
                ))}
                {zeroLine}
                {rounds.map((r, i) => (
                    <g key={i}>
                        {r.dividerX > M.left
                            ? <line className="score-chart-round-edge" x1={r.dividerX} x2={r.dividerX}
                                    y1={M.top} y2={M.top + plotH}/>
                            : null}
                        {showRoundLabels
                            ? <text className="score-chart-round-label" x={(x(r.first) + x(r.last)) / 2}
                                    y={M.top + plotH + tickFont + roundFont + 6} textAnchor="middle"
                                    style={{fontSize: roundFont}}>R{r.round}</text>
                            : null}
                    </g>
                ))}
                {xLabels.map((l, i) => (
                    <text key={i} className="score-chart-x-label" x={l.x}
                          y={M.top + plotH + tickFont + 6} textAnchor="middle"
                          style={{fontSize: tickFont}}>{l.text}</text>
                ))}
                <line className="score-chart-axis" x1={M.left} x2={M.left + plotW}
                      y1={M.top + plotH} y2={M.top + plotH}/>
                <line className="score-chart-axis" x1={M.left} x2={M.left}
                      y1={M.top} y2={M.top + plotH}/>
                {lines}
            </svg>
            {tooltip}
        </div>
    )
}

export default ScoreChart
