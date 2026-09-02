import React from 'react';
import sendData from "../index"
import ScoreChart, {Series} from "./ScoreChart"
import {teamColors} from "../common/colors"
import "./ScoreGraphModal.css"

import {Alert, Modal, Spin} from 'antd';

/**
 * The score graph modal (ticket #237, part of #233): fetches the session's
 * cumulative-score history and renders it with ScoreChart (#236).
 *
 * It owns the fetch so ScoreChart stays presentational. Opened from the
 * scoreboard's title button; read-only, so no save footer.
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
    onClose: () => void
}

interface State {
    axis: string[]
    series: Series[]
    loading: boolean
    error: string | null
    // The chart's viewBox, kept in state so a viewport change re-renders it.
    size: {width: number, height: number}
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
    }

    mounted = false
    // Ticket #146 pattern: a slow response for a superseded request must not
    // overwrite a newer one.
    fetchCounter = 0

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
            this.setState({axis: [], series: []}, () => this.load())
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

    render() {
        const {axis, series, loading, error, size} = this.state
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
                    <ScoreChart axis={axis} series={series} width={width} height={height}/>
                    {loading ? <div className="score-graph-refresh">Updating…</div> : null}
                </div>
            )
        }

        return (
            <Modal title="Score progression" open={this.props.open} onCancel={this.props.onClose}
                   centered={true} footer={null} destroyOnHidden={true}
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
        }
    })

    return {axis, series}
}

export default ScoreGraphModal
