import React from 'react';
import "./Players.css"

class AnsweredOrNot extends React.Component {

    render() {
        return (
            <div className="one-player-status" >
                <div className="team-name"> {this.props.player_name} </div>
                <div className="answered-or-not"> {this.props.answered ? "✓" : "--" }    </div>
            </div>
        );
    }
}

export default AnsweredOrNot;