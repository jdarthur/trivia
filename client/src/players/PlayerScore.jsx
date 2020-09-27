import React from 'react';
import "./Players.css"

import PlayerIcon from '../lobby/PlayerIcon';
import { Card } from "antd"

class PlayerScore extends React.Component {
    render() {
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        return (
            <Card size="small" title={this.props.team_name} extra={icon}
                style={{ 'min-width': 150 }} bodyStyle={{ padding: 0 }}  >
                <div className="scoreboard-score"> {this.props.score} </div>
            </Card>
        );

        // return (
        //     <div className="one-player-score" >
        //         <div className="scoreboard-score"> {this.props.score } </div>
        //         <div className="scoreboard-team"> {this.props.team_name} </div>
        //     </div>
        // );
    }
}

export default PlayerScore;