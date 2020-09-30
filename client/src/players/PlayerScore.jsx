import React from 'react';
import "./Players.css"

import PlayerIcon from '../lobby/PlayerIcon';
import { Card } from "antd"

class PlayerScore extends React.Component {
    render() {
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            {is_self ? <span className="self-indicator"> • </span>: null}
            {this.props.team_name}
        </div>
        return (
            <Card size="small" title={title} extra={icon}
                style={{ 'width': 180}} bodyStyle={{ padding: 0 }} headStyle={{}}  >
                <div className="scoreboard-score"> {this.props.score} </div>
            </Card>
        );
    }
}

export default PlayerScore;