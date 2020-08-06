import React from 'react';
import "./Players.css"
/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class CorrectOrNot extends React.Component {

    render() {
        const class_name = "player-wager "  + (this.props.correct && this.props.points_awarded > 0 ? "": "in") + "correct"
        const amount_to_show = this.props.correct ? this.props.points_awarded : this.props.wager
        return (
            <div className="one-player-status" >
                <div className="team-name"> {this.props.player_name} </div>
                <div className="answer-text"> {this.props.answer} </div>
                <div className={class_name} >
                    <div className="player-name"> {amount_to_show} </div>
                    <div> {this.props.correct ? "✓" : "✗" } </div>
                </div>
            </div>
        );
    }
}

export default CorrectOrNot;