import React from 'react';
import sendData from "../index"
import PlayerScore from "./PlayerScore"
import ScoreGraphModal from "./ScoreGraphModal"
import "./Scoreboard.css"

import {
    FundProjectionScreenOutlined
} from '@ant-design/icons';
import {Button} from "antd";
import type { PlayerScore as PlayerScoreModel } from '../types/models';

interface Props {
    session_id: string
    player_id: string
    round_id: string | number | null
    session_state: any
    question_id?: string | number
    // Kept for API compatibility. The layout now reflows responsively (a
    // compact column on wide screens, a horizontal strip across the top on
    // narrow ones) instead of switching to a modal, so this is unused.
    is_mobile?: boolean
}

interface State {
    scores: PlayerScoreModel[]
    // Ticket #237: whether the score-graph modal is open.
    graph_open: boolean
}

class Scoreboard extends React.Component<Props, State> {

    state: State = {
        scores: [],
        graph_open: false,
    }

    // Ticket #146: a slow response for a previous question/round must not
    // overwrite the current one (WagerManager pattern).
    fetchCounter = 0

    componentDidMount() {
        const scoresStored = JSON.parse(sessionStorage.getItem("scoreboard") || "null")
        if (scoresStored) {
            this.setState({ scores: scoresStored }, () => this.get_scoreboard())
        } else {
            this.get_scoreboard()
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_scoreboard()
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_scoreboard()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_scoreboard()
        }
    }

    get_scoreboard = () => {

        if (this.props.round_id !== "" && this.props.round_id !== null && this.props.round_id !== undefined) {
            this.fetchCounter += 1
            const currentFetch = this.fetchCounter

            let url = "/gameplay/session/" + this.props.session_id + "/scoreboard"
            url += "?player_id=" + this.props.player_id
            console.log(url)
            sendData(url, "GET")
                .then((data: any) => {
                    console.log(data)
                    // Only apply if this is still the latest request.
                    if (currentFetch === this.fetchCounter) {
                        sessionStorage.setItem("scoreboard", JSON.stringify(data.scores))
                        this.setState({ scores: data.scores })
                    }
                })
                .catch((error) => {
                    console.error("Failed to fetch scoreboard:", error)
                })
        }
    }

    // Ticket #237: the title's icon is the entry point to the score graph.
    open_graph = () => this.setState({graph_open: true})
    close_graph = () => this.setState({graph_open: false})

    render() {
        const scores_sorted = this.state.scores?.sort((a, b) => {
            const score_a = sum(a.score)
            const score_b = sum(b.score)
            if (score_a === score_b) {
                return a.team_name > b.team_name ? 1 : -1
            }
            return (score_a > score_b) ? -1 : 1
        })

        const scores = scores_sorted.map((player, index) => {
            const background = ((index + 1) % 2) === 1 ? "#fafafa" : ""
            return <PlayerScore key={player.team_name} team_name={player.team_name}
                score={sum(player.score)} icon_name={player.icon} background={background}
                player_id={player.player_id} current_player={this.props.player_id}
                active={player.active} />
        })

        // The icon was decorative; it's now the entry point to the score graph
        // (ticket #237). A text Button keeps keyboard activation and a visible
        // hover/focus state, and stays quiet -- the title row must not grow
        // (see .scoreboard-graph-button in ScoreGraphModal.css).
        const graph_button = <Button type="text" size="small" className="scoreboard-graph-button"
                                     icon={<FundProjectionScreenOutlined/>}
                                     aria-label="Show score graph"
                                     onClick={this.open_graph}/>

        // Compact single-line rows. The orientation (column vs. horizontal
        // strip) is decided by CSS media queries in Scoreboard.css, so the
        // markup is the same for every screen size.
        const scoreboard = <div className="scoreboard">
            <div className="scoreboard-title">
                <span>Scoreboard</span>
                {graph_button}
            </div>
            {scores}
            <ScoreGraphModal open={this.state.graph_open} session_id={this.props.session_id}
                             player_id={this.props.player_id} round_id={this.props.round_id}
                             session_state={this.props.session_state}
                             question_id={this.props.question_id}
                             onClose={this.close_graph}/>
        </div>

        return scoreboard
    }
}

function sum(list: number[] | undefined) {
    return (list || []).reduce(function (a, b) { return a + b; }, 0);
}

export default Scoreboard;
