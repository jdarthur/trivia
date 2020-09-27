import React from 'react';
import sendData from "../index"
import PlayerScore from "./PlayerScore"
import "./Players.css"

import {
    FundProjectionScreenOutlined
} from '@ant-design/icons';

class Scoreboard extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            scores: [],
        }
    }

    componentDidMount() {
        this.get_scoreboard()
    }

    componentDidUpdate(prevProps) {
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

            let url = "/gameplay/session/" + this.props.session_id + "/scoreboard"
            url += "?player_id=" + this.props.player_id
            console.log(url)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    this.setState({ scores: data })
                })
        }
    }

    render() {
        const scores_sorted = this.state.scores.sort((a, b) => {
            const score_a = sum(a.score)
            const score_b = sum(b.score)
            return (score_a > score_b) ? -1 : 1
        })

        const scores = scores_sorted.map(player => {
            return <PlayerScore key={player.player_name} team_name={player.team_name}
                score={sum(player.score)} icon_name={player.icon} />
        })

        return (
            <div className="scoreboard" >
                <div className="scoreboard-title">
                <FundProjectionScreenOutlined />
                <span style={{'padding-left': '10px'}}>Scoreboard</span>
                </div>
                {scores}
            </div>
        );
    }
}

function sum(list) {
    return (list || []).reduce(function (a, b) { return a + b; }, 0);
}

export default Scoreboard;