import React from 'react';
import sendData from "../index"
import ScoreChart, {Series} from "./ScoreChart"
import {chartToPngBlob, downloadBlob, exportFilename, LegendEntry} from "./ExportPng"
import {teamColors} from "../common/colors"
import ShortTextWithPopover from "../common/ShortTextWithPopover";
import PlayerIcon from '../lobby/PlayerIcon';
import "./ScoreGraphModal.css"

import {Alert, Button, Modal, Spin} from 'antd';
import {DownloadOutlined} from '@ant-design/icons';

/**
 * The score graph modal (ticket #237, part of #233): fetches the session's
 * cumulative-score history and renders it with ScoreChart (#236) plus the
 * legend (ticket #238).
 *
 * It owns the fetch so ScoreChart stays presentational. Opened from the
 * scoreboard's title button; read-only, so no save footer.
 *
 * The legend (ticket #238) renders below the chart: one row per team — color
 * dot + icon + name + final total — in the same order as the scoreboard
 * (total desc, then name asc; the series come from toChartData already sorted
 * that way). Rows double as click-to-isolate: clicking one fades every other
 * line in the chart (handy for a 12-team game), clicking again restores.
 *
 * Refresh policy: fetch on open, then again whenever the parent's session
 * token / round / question changes while open, so an open graph tracks the
 * live game. The last response is cached in sessionStorage (same pattern as
 * Scoreboard's "scoreboard" key) so reopening during a network stall still
 * paints something immediately.
 */

interface Props {
    open: boolean
    session_id: string
    player_id: string
    round_id: string | number | null
    session_state: any
    question_id?: string | number
    /** Session name, for the PNG export's filename (ticket #240). */
    session_name?: string
    onClose: () => void
}

interface State {
    axis: string[]
    series: Series[]
    loading: boolean
    error: string | null
    // The chart's viewBox, kept in state so a viewport change re-renders it.
    size: {width: number, height: number}
    // Click-to-isolate (ticket #238): the team name whose line stays bright;
    // null = nothing isolated.
    isolated: string | null
    // PNG export (ticket #240): true while rasterizing, and a sticky note when
    // this browser couldn't produce a file — the button retires itself rather
    // than throwing at the user on every click.
    exporting: boolean
    export_failed: boolean
}

// One series of GET /gameplay/session/:id/score-history (models.ScoreHistorySeries).
interface HistorySeries {
    team_name: string
    icon?: string
    player_id?: string
    active?: boolean
    cumulative?: number[]
}

const CACHE_KEY = "score_history"

// The chart's viewBox is sized to the modal rather than fixed at 800: ScoreChart
// scales all of its text with the viewBox, so a wide viewBox squeezed into a
// phone would shrink the axis labels. width is kept near the modal's CSS pixel
// width at both ends of the range (see the note in ScoreChart's doc block).
function chartSize(): {width: number, height: number} {
    const vw = typeof window === 'undefined' ? 720 : window.innerWidth
    // Modal is min(720px, 92vw) with ~48px of padding plus a scrollbar gutter.
    const width = Math.round(Math.min(672, Math.max(280, vw * 0.92 - 48)))
    return {width, height: Math.round(Math.min(420, Math.max(220, width * 0.56)))}
}

class ScoreGraphModal extends React.Component<Props, State> {

    state: State = {
        axis: [],
        series: [],
        loading: false,
        error: null,
        size: chartSize(),
        isolated: null,
        exporting: false,
        export_failed: false,
    }

    mounted = false
    // Ticket #146 pattern: a slow response for a superseded request must not
    // overwrite a newer one.
    fetchCounter = 0
    // The chart's <svg>, rasterized by the PNG export (ticket #240). Null in
    // the empty state, which is one of the things that disables the button.
    svg_ref = React.createRef<SVGSVGElement>()

    componentDidMount() {
        this.mounted = true
        // The chart's viewBox tracks the viewport (see chartSize). A window
        // listener rather than a ResizeObserver: the modal's width is a function
        // of the viewport, not of its content, so this catches rotation and
        // window drags without observing anything.
        window.addEventListener('resize', this.on_resize)
        if (this.props.open) this.load()
    }

    componentDidUpdate(prevProps: Props) {
        // Fetch on open, and on any game change while open so the graph tracks
        // the live game.
        if (!prevProps.open && this.props.open) {
            this.load()
            return
        }
        if (!this.props.open) return

        if (this.props.session_id !== prevProps.session_id) {
            // A different session: drop the previous one's data instead of
            // showing it while the new session loads. readCache() is keyed by
            // session, so it returns null here and the modal shows the spinner.
            // Isolation is per-session data too, so it resets.
            this.setState({axis: [], series: [], isolated: null}, () => this.load())
            return
        }

        if (this.props.session_state !== prevProps.session_state
            || this.props.round_id !== prevProps.round_id
            || this.props.question_id !== prevProps.question_id) {
            this.load()
        }
    }

    componentWillUnmount() {
        this.mounted = false
        window.removeEventListener('resize', this.on_resize)
    }

    on_resize = () => {
        if (!this.mounted) return
        const next = chartSize()
        if (next.width === this.state.size.width && next.height === this.state.size.height) return
        this.setState({size: next})
    }

    load = () => {
        this.fetchCounter += 1
        const currentFetch = this.fetchCounter

        // Paint the cached history immediately (if any) so a reopen isn't a
        // blank box for a round trip; the live response replaces it below.
        const cached = this.readCache()
        if (cached) {
            this.setState({axis: cached.axis, series: cached.series, error: null, loading: true})
        } else {
            this.setState({loading: true, error: null})
        }

        const url = "/gameplay/session/" + this.props.session_id + "/score-history"
            + "?player_id=" + this.props.player_id

        sendData(url, "GET")
            .then((data: any) => {
                if (!this.mounted || currentFetch !== this.fetchCounter) return
                const {axis, series} = toChartData(data)
                this.writeCache(axis, series)
                this.setState({axis, series, loading: false, error: null})
            })
            .catch((error) => {
                if (!this.mounted || currentFetch !== this.fetchCounter) return
                console.error("Failed to fetch score history:", error)
                // Keep whatever is already on screen (cache or previous poll): a
                // transient failure shouldn't blank a graph that's showing a
                // race, and it must never take the scoreboard down with it.
                // Read state in the updater, not the closure, so this reflects
                // the cache paint above rather than the value at call time.
                this.setState(prev => ({
                    loading: false,
                    error: prev.series.length > 0 ? null : "Couldn't load the score graph.",
                }))
            })
    }

    // Keyed by session so switching sessions can't paint the previous session's
    // graph while the new one loads.
    cacheKey() {
        return CACHE_KEY + ":" + this.props.session_id
    }

    writeCache(axis: string[], series: Series[]) {
        try {
            sessionStorage.setItem(this.cacheKey(), JSON.stringify({axis, series}))
        } catch (e) {
            // A full quota or a blocked-storage browser shouldn't fail a good
            // response; the cache is only an optimization.
            console.warn("Could not cache score history:", e)
        }
    }

    readCache(): {axis: string[], series: Series[]} | null {
        try {
            const raw = sessionStorage.getItem(this.cacheKey())
            if (!raw) return null
            const parsed = JSON.parse(raw)
            if (!parsed || !Array.isArray(parsed.axis) || !Array.isArray(parsed.series)) return null
            return {axis: parsed.axis, series: parsed.series}
        } catch (e) {
            // A malformed or quota-damaged cache is not worth failing over.
            return null
        }
    }

    // Click-to-isolate (ticket #238): picking a legend row fades every other
    // line in the chart; picking the same row again restores all of them.
    toggleIsolate = (name: string) => {
        this.setState(prev => ({isolated: prev.isolated === name ? null : name}))
    }

    // PNG export (ticket #240): rasterize the live chart SVG plus the legend's
    // data at 2x and download it. The legend is rebuilt as SVG primitives from
    // `series` rather than copied from the DOM, so no team icon (an antd
    // <span> with a webfont glyph) can drop out of or taint the canvas.
    export_png = () => {
        const svg = this.svg_ref.current
        if (!svg || this.state.exporting) return
        this.setState({exporting: true})
        const legend: LegendEntry[] = this.state.series.map(s => ({
            name: s.name,
            color: s.color,
            total: s.values.length > 0 ? fmtTotal(s.values[s.values.length - 1]) : "0",
            active: s.active,
        }))
        chartToPngBlob(svg, legend)
            .then(blob => {
                downloadBlob(blob, exportFilename(this.props.session_name, this.props.session_id))
                if (this.mounted) this.setState({exporting: false})
            })
            .catch(error => {
                // A canvas this browser won't rasterize is not the player's
                // problem to read about: drop the control and carry on. The
                // graph itself is untouched.
                console.error("Failed to export the score graph:", error)
                if (this.mounted) this.setState({exporting: false, export_failed: true})
            })
    }

    // The legend (ticket #238): one row per team in scoreboard order — the
    // series come from toChartData already sorted (total desc, name asc), so
    // this agrees with the scoreboard list beside the modal. Each row doubles
    // as a mini standings entry: color dot (exactly the line's stroke) + icon
    // + team name + final cumulative total. Long names reuse
    // ShortTextWithPopover so a row never wraps.
    renderLegend() {
        const {series, isolated} = this.state
        return (
            <div className="score-graph-legend" role="list">
                {series.map((s, i) => {
                    const total = s.values.length > 0 ? fmtTotal(s.values[s.values.length - 1]) : "0"
                    const inactive = s.active === false
                    const pressed = isolated === s.name
                    return (
                        <button key={i} type="button" role="listitem"
                                className={"score-graph-legend-row" + (inactive ? " inactive" : "")}
                                title={pressed ? "Restore all teams" : "Highlight this team"}
                                aria-pressed={pressed}
                                onClick={() => this.toggleIsolate(s.name)}>
                            <span className="score-graph-legend-dot" style={{background: s.color}}/>
                            <PlayerIcon icon_name={s.icon}/>
                            {/* Name and total are one cluster rather than
                                opposite ends of the row: with the row up to
                                ~330px wide, pushing the total to the far right
                                left a gap wide enough to read as belonging to
                                whichever neighbour it landed under. */}
                            <span className="score-graph-legend-label">
                                <span className="score-graph-legend-name">
                                    <ShortTextWithPopover text={s.name} maxLength={20}/>
                                </span>
                                <span className="score-graph-legend-sep" aria-hidden="true">·</span>
                                <span className="score-graph-legend-total">{total}</span>
                            </span>
                        </button>
                    )
                })}
            </div>
        )
    }

    render() {
        const {axis, series, loading, error, size, exporting, export_failed} = this.state
        const {width, height} = size

        let body: React.ReactNode
        if (error) {
            body = <Alert type="error" showIcon message={error}
                          description="Your scores are unaffected — try opening the graph again."/>
        } else if (loading && series.length === 0) {
            // Nothing to draw yet and a request in flight: hold the space so the
            // modal doesn't flash "No scores yet" (ScoreChart's empty state) or
            // jump when the chart lands. The Spin below covers this box.
            body = <div className="score-graph-placeholder"
                        style={{aspectRatio: `${width} / ${height}`}}/>
        } else {
            // Includes the empty case (no questions reached, or nobody scored
            // yet) -- ScoreChart renders its own empty state for that.
            body = (
                <div className="score-graph-body">
                    <ScoreChart axis={axis} series={series} width={width} height={height}
                                isolated={this.state.isolated} svgRef={this.svg_ref}/>
                    {series.length > 0 ? this.renderLegend() : null}
                    {loading ? <div className="score-graph-refresh">Updating…</div> : null}
                </div>
            )
        }

        // Export lives in the footer (ticket #240), and only when there is
        // something to export: nothing drawn, or a browser that already failed
        // to rasterize once. Hiding it beats a control that can only fail. It
        // stays enabled during a background refresh — the user exports what's
        // on screen — so it doesn't flicker every time the live game ticks.
        // `drawable` mirrors ScoreChart's own empty condition (no axis, or no
        // series with a number): without a drawn <svg> there is nothing to
        // rasterize, and the ref would be null.
        const drawable = axis.length > 0 && series.some(s => s && s.values.length > 0)
        const can_export = !error && !export_failed && drawable
        const footer = can_export
            ? <div className="score-graph-footer">
                <Button icon={<DownloadOutlined/>} loading={exporting}
                        onClick={this.export_png}>
                    Export PNG
                </Button>
            </div>
            : null

        return (
            <Modal title="Score progression" open={this.props.open} onCancel={this.props.onClose}
                   centered={true} footer={footer} destroyOnHidden={true}
                   width="min(720px, 92vw)" className="score-graph-modal">
                <Spin spinning={loading && series.length === 0}>
                    {body}
                </Spin>
            </Modal>
        )
    }
}

/**
 * Map the score-history response to chart props.
 *
 * Colors come from teamColors(), which requires its input ordered the way the
 * scoreboard orders rows — total score descending, then team name ascending —
 * so a team's line color matches the (future) legend and stays stable while the
 * standings don't. The total is the last cumulative value.
 */
export function toChartData(data: any): {axis: string[], series: Series[]} {
    const axis: string[] = Array.isArray(data?.points_per_question) ? data.points_per_question : []
    const raw: HistorySeries[] = Array.isArray(data?.series) ? data.series : []

    const totals = raw.map(s => {
        const cum = Array.isArray(s.cumulative) ? s.cumulative : []
        const last = cum[cum.length - 1]
        return Number.isFinite(last) ? last : 0
    })

    const order = raw.map((_, i) => i).sort((a, b) => {
        if (totals[a] !== totals[b]) return totals[a] > totals[b] ? -1 : 1
        const na = raw[a].team_name ?? ""
        const nb = raw[b].team_name ?? ""
        return na > nb ? 1 : na < nb ? -1 : 0
    })

    const orderedNames = order.map(i => raw[i].team_name ?? "")
    const colors = teamColors(orderedNames)

    // Look the color up by team name, not by the map's index: inside
    // order.map, `i` is the ORIGINAL index while `orderedNames` is in SORTED
    // order, so `colors[orderedNames[i]]` would hand each team another team's
    // hue whenever the sort actually reorders the list.
    const series: Series[] = order.map(i => {
        const name = raw[i].team_name ?? ""
        return {
            name,
            color: colors[name],
            values: Array.isArray(raw[i].cumulative) ? raw[i].cumulative : [],
            icon: raw[i].icon,
            active: raw[i].active,
        }
    })

    return {axis, series}
}

// The legend's final total; same rounding as the chart's axis labels.
function fmtTotal(v: number): string {
    return String(Math.round(v * 100) / 100)
}

export default ScoreGraphModal
