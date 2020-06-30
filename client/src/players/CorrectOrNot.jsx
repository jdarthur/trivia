import React from 'react';
import "./Players.css"
/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class AnsweredOrNot extends React.Component {

    render() {
        const class_name = "one-player-status" + (this.props.correct ? " correct" : "incorrect")
        return (
            <div className={class_name} >
                <div className="player-name"> {this.props.player_name} </div>
                <div className="player-name"> {this.props.answer} </div>
                <div className="player-name"> {this.props.wager} </div>
            </ div>
        );
    }
}

export default AnsweredOrNot;