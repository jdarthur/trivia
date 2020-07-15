import React from 'react';
import sendData from "../index"
import AnsweredOrNot from "./AnsweredOrNot"
import CorrectOrNot from "./CorrectOrNot"
import "./Players.css"

class PlayerStatus extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            answers: []
        }
    }

    componentDidMount() {
        this.get_answers()
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_answers()
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_answers()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_answers()
        }
    }

    get_answers = () => {
        console.log(this.props)
        if (this.props.round_id !== "" && this.props.question_id !== "") {

            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)

            console.log(this.props)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    this.setState({answers: data.answers })
                })
        }
    }

    render() {
        const answers = this.state.answers.map(player => {
            if (this.props.scored)
                return <CorrectOrNot key={player.team_name} player_name={player.team_name}
                    answer={player.answer} wager={player.wager} correct={player.correct} />
            else return <AnsweredOrNot key={player.team_name} player_name={player.team_name}
                answered={player.answered} />
        })

        return (
            <div className="player-status-bar" >
                {answers}
            </div>
        );
    }
}

export default PlayerStatus;