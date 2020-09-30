import React from 'react';
import "./Players.css"
import PlayerIcon from '../lobby/PlayerIcon';

import { Card } from "antd"

import {
    CheckSquareOutlined,
    CloseSquareOutlined
} from '@ant-design/icons';


/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class CorrectOrNot extends React.Component {

    render() {
        const class_name = "player-wager "  + (this.props.correct && this.props.points_awarded > 0 ? "": "in") + "correct"
        const amount_to_show = this.props.correct ? this.props.points_awarded : this.props.wager
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>

        const correct_icon = this.props.correct ? <CheckSquareOutlined /> : <CloseSquareOutlined />
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            {this.props.player_name}
        </div>
        return (
            <Card size="small" title={title} extra={icon}
                style={{ 'min-width': 150 }} bodyStyle={{ padding: 0 }}  >
                <div className="answer-text"> {this.props.answer} </div>
                <div className={class_name} >
                    <div> {amount_to_show} </div>
                    <div> {correct_icon} </div>
                </div>
            </Card>
        )
    }


            // <div className="one-player-status" >
            //     <div className="team-name"> {this.props.player_name} </div>
            //     <div className="answer-text"> {this.props.answer} </div>
            //     <div className={class_name} >
            //         <div className="player-name"> {amount_to_show} </div>
            //         <div> {this.props.correct ? "✓" : "✗" } </div>
            //     </div>
            // </div>
        //);
}

export default CorrectOrNot;