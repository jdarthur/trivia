import React from 'react';
import "./Scoreboard.css"

import PlayerIcon from '../lobby/PlayerIcon';
import { Card } from "antd"

class PlayerScore extends React.Component {
    render() {
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        const is_self = this.props.player_id === this.props.current_player
        const team = <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            {is_self ? <span className="self-indicator"> • </span>: null}
            {this.props.team_name}
        </div>
        return (
            <Card size="small" title={this.props.score} extra={icon}
                style={{ 'width': 150, background: this.props.background}} headStyle={{fontSize: '1.2em', fontWeight: 'bold'}}  >
                <div > {team} </div>
            </Card>
        );
    }
}

export default PlayerScore;