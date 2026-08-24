import React from 'react';
import "./Scoreboard.css"

import PlayerIcon from '../lobby/PlayerIcon';
import {Card} from "antd"
import ShortTextWithPopover from "../common/ShortTextWithPopover";

interface Props {
    team_name: string
    score: number
    icon_name?: string
    player_id?: string
    current_player?: string
    background: string
    active?: boolean
}

class PlayerScore extends React.Component<Props> {
    render() {
        const icon = <div className="delete-edit-mini">
            <PlayerIcon icon_name={this.props.icon_name}/>
        </div>
        const is_self = this.props.player_id === this.props.current_player
        const inactive = this.props.active === false
        const team = <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            <ShortTextWithPopover text={this.props.team_name} maxLength={20}/>
        </div>
        const score = <span style={inactive ? {textDecoration: 'line-through'} : undefined}>{this.props.score}</span>
        return (
            <Card size="small" title={score} extra={icon}
                  style={{'width': 150, background: this.props.background, opacity: inactive ? 0.5 : 1}}
                  headStyle={{fontSize: '1.2em', fontWeight: 'bold'}}>
                <div style={inactive ? {filter: 'grayscale(1)'} : undefined}> {team} </div>
            </Card>
        );
    }
}

export default PlayerScore;
