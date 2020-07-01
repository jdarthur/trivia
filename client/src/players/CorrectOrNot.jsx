import React from 'react';
import "./Players.css"
/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class AnsweredOrNot extends React.Component {

    render() {
        const class_name = "player-wager "  + (this.props.correct ? "": "in") + "correct"
        return (
            <div className="one-player-status" >
                <div className="team-name"> {this.props.player_name} </div>
                <div className="answer-text"> {this.props.answer} </div>
                <div className={class_name} >
                    <div className="player-name"> {this.props.wager} </div>
                    <div> {this.props.correct ? "✓" : "✗" } </div>
                </div>
            </div>
        );
    }
}

export default AnsweredOrNot;