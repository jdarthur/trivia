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
        // A single-line row: the team (icon + self indicator + name) in the
        // title and the score on the right. No card body, so each player is
        // one short line rather than a tall block. The self indicator sits
        // between the icon and the name: the icons line up vertically and
        // only the current player's name is offset by the dot.
        const title = <div className="scoreboard-team" style={inactive ? {opacity: 0.5} : undefined}>
            <span className="scoreboard-team-icon">{icon}</span>
            {is_self ? <span className="self-indicator"> • </span> : null}
            <ShortTextWithPopover text={this.props.team_name} maxLength={20}/>
        </div>
        const score = <span className="scoreboard-score" style={inactive ? {textDecoration: 'line-through'} : undefined}>
            {this.props.score}
        </span>
        return (
            <Card size="small" title={title} extra={score}
                  className={"scoreboard-row" + (inactive ? " inactive" : "")}
                  style={{background: this.props.background}}
                  headStyle={{fontSize: '1em', fontWeight: 'bold'}}/>
        );
    }
}

export default PlayerScore;
