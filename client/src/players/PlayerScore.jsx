import React from 'react';
import "./Players.css"

class PlayerScore extends React.Component {
    render() {
        return (
            <div className="one-player-score" >
                <div className="scoreboard-score"> {this.props.score } </div>
                <div className="scoreboard-team"> {this.props.team_name} </div>
            </div>
        );
    }
}

export default PlayerScore;