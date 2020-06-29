import React from 'react';
import sendData from "../index"
import PlayerAnswer from "./PlayerAnswer"
import "./Players.css"

class PlayerScorer extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            scores: {},
        }
    }

    score = () => {
        if (this.scorable()) {
            const url = "/gameplay/session/" + this.props.session_id + "/score"
            const body = {
                player_id: this.props.player_id,
                round_id: this.props.round_id,
                question_id: this.props.question_id,
                players: this.state.scores
            }
            console.log(url)
            console.log(body)
    
            // sendData(url, "PUT", body)
            //     .then((data) => {
            //         console.log(data)
            //     })
        }
    }

    set_correct = (player_id, correct) => {
        const scores = this.state.scores
        scores[player_id] = { correct: correct }
        this.setState({ scores: scores })
    }

    scorable = () => {
        for (let i = 0; i < this.props.answers.length; i++) {
            const player_id = this.props.answers[i].player_id
            if (this.state.scores[player_id] === undefined) {
                return false
            }  
        }
        return true
    }

    render() {
        const answers = this.props.answers.map(player => {
            const status = this.state.scores[player.player_id] || {}
            return <PlayerAnswer key={player.player_id} player_id={player.player_id}
                answer={player.answer} wager={player.answer} set_correct={this.set_correct}
                player_name={player.player_name} correct={status.correct} /> })
        
        const score_class = this.scorable() ? "" : "disabled"
        
        return (
            <div className="player-scorer" >
                {answers}
                <button onClick={this.score} className={score_class}> Score </button>
            </div>
        );
    }
}

export default PlayerScorer;