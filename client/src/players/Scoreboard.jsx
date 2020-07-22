import React from 'react';
import sendData from "../index"
import PlayerScore from "./PlayerScore"
import "./Players.css"

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
        const scores = this.state.scores.map(player => {
            return <PlayerScore key={player.player_name}
                    team_name={player.team_name} score={player.score} /> })

        return (
            <div className="scoreboard" >
                Scoreboard:
                {scores}
            </div>
        );
    }
}

export default Scoreboard;