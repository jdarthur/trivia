import React from 'react';
import "./Players.css"
import PlayerIcon from '../lobby/PlayerIcon';
import MultiAnswer from "../admin-scorer/MultiAnswer"

import {Card} from "antd"

import {
    CheckSquareOutlined,
    CloseSquareOutlined
} from '@ant-design/icons';
import ShortTextWithPopover from "../common/ShortTextWithPopover";


/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class CorrectOrNot extends React.Component {

    render() {
        let last_answer = {}
        if (this.props.answers?.length > 0) {
            last_answer = this.props.answers[this.props.answers.length - 1]
        }

        //player's icon
        const icon = <div className="delete-edit-mini" style={{padding: 0}}>
            <PlayerIcon icon_name={this.props.icon_name}/>
        </div>

        //team name
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            <ShortTextWithPopover text={this.props.player_name} maxLength={20}/>
        </div>

        //correctness icon + wager
        const class_name = "player-wager " + (last_answer.correct && last_answer.points_awarded > 0 ? "" : "in") + "correct"
        let correctness_and_wager = <div className={class_name}>
            <div> {last_answer.correct ? last_answer.points_awarded : last_answer.wager} </div>
            <div> {last_answer.correct ? <CheckSquareOutlined/> : <CloseSquareOutlined/>} </div>
        </div>

        return (<div style={{display: 'flex', alignItems: 'stretch'}}>
                {this.props.is_mobile ?
                    // show mini status on mobile
                    <Card style={{width: 65}} bodyStyle={{padding: 0}}>
                        <div style={{display: 'flex', justifyContent: 'center', padding: 5}}>
                            {icon}
                        </div>
                        {correctness_and_wager}
                    </Card> :
                    //show full version with full answers
                    <Card size="small" title={title} extra={icon}
                          style={{
                              minWidth: 150,
                              maxWidth: 300,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                          }}>

                        <div className="answer-text"><MultiAnswer answers={this.props.answers} omitWager={true}/></div>
                        {correctness_and_wager}
                    </Card>}
            </div>
        )

    }
}

export default CorrectOrNot;