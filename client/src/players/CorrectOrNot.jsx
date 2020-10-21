import React from 'react';
import "./Players.css"
import PlayerIcon from '../lobby/PlayerIcon';
import MultiAnswer from "./MultiAnswer"

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
        const last_answer = {}
        if (this.props.answers?.length > 0) {
            last_answer = this.props.answers[this.props.answers.length - 1]
        }

        const class_name = "player-wager " + (last_answer.correct && last_answer.points_awarded > 0 ? "" : "in") + "correct"
        const amount_to_show = last_answer.correct ? last_answer.points_awarded : last_answer.wager
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        const correct_icon = last_answer.correct ? <CheckSquareOutlined /> : <CloseSquareOutlined />
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            {this.props.player_name}
        </div>
        return (
            <Card size="small" title={title} extra={icon}
                style={{ minWidth: 150, maxWidth: 300, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} bodyStyle={{ padding: 0 }}  >
                <div className="answer-text"> <MultiAnswer answers={this.props.answers} /> </div>
                <div className={class_name} >
                    <div> {amount_to_show} </div>
                    <div> {correct_icon} </div>

                </div>
            </Card>
        )

    }
}

export default CorrectOrNot;