import React from 'react';
import "./Players.css"
import PlayerIcon from '../lobby/PlayerIcon';
import MultiAnswer from "../admin-scorer/MultiAnswer"

import {Card, Tooltip} from "antd"

import {
    CheckSquareOutlined,
    CloseSquareOutlined
} from '@ant-design/icons';
import ShortTextWithPopover from "../common/ShortTextWithPopover";

interface AnswerLike {
    answer: string
    wager: number
    correct?: boolean
    points_awarded?: number
    use_moneyball?: boolean
    answer_id?: string
    reactions?: Record<string, number>
    my_reaction?: string
}

interface Props {
    player_name: string
    answers?: AnswerLike[]
    icon_name: string
    current_player: string
    player_id: string
    session_id: string
    is_mobile?: boolean
    wager?: number
    correct?: boolean
    points_awarded?: number
    // question_type lets the player-status view render structured answers
    // readably (matching answers are a JSON map string — ticket #162).
    question_type?: string
}

/**
 * this is a player view of other teams' correctness
 * aftr the question has been scored
 */
class CorrectOrNot extends React.Component<Props> {

    // Moneyball outcome marker (ticket #3): 🤑 on a 2X hit, 🤑 with a note
    // when the moneyball paid normal points, 😞 when it missed (0 points or
    // negative).
    moneyball_marker = (answer: AnswerLike): React.ReactNode => {
        if (!answer.use_moneyball) return null
        const wager = answer.wager || 0
        let text: string
        let emoji: string
        if (answer.correct && answer.points_awarded === 2 * wager) {
            text = "Moneyball successful — 2X points!"
            emoji = "🤑"
        } else if (answer.correct && answer.points_awarded === wager) {
            text = "Moneyball — normal points, no bonus"
            emoji = "🤑"
        } else {
            text = "Missed Moneyball — get 'em next time!"
            emoji = "😞"
        }
        return <Tooltip title={text}><span style={{marginLeft: 4}}>{emoji}</span></Tooltip>
    }

    render() {
        let last_answer: AnswerLike = {answer: "", wager: 0}
        if (this.props.answers && this.props.answers.length > 0) {
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
        //color by correctness: a correct moneyball answer that pays 0 (2+
        //others correct) is still a correct answer and gets the green card
        const class_name = "player-wager " + (last_answer.correct ? "" : "in") + "correct"
        let correctness_and_wager = <div className={class_name}>
            <div> {last_answer.correct ? last_answer.points_awarded : last_answer.wager} {this.moneyball_marker(last_answer)} </div>
            <div> {last_answer.correct ? <CheckSquareOutlined/> : <CloseSquareOutlined/>} </div>
        </div>

        return (<div className={this.props.is_mobile ? "player-status-box player-status-box-mini" : "player-status-box"}
                 style={{display: 'flex', alignItems: 'stretch'}}>
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
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                          }}>

                        <div className="answer-text"><MultiAnswer answers={this.props.answers} omitWager={true}
                                                                  session_id={this.props.session_id}
                                                                  current_player={this.props.current_player}
                                                                  question_type={this.props.question_type}
                                                                  scored={true}/></div>
                        {correctness_and_wager}
                    </Card>}
            </div>
        )

    }
}

export default CorrectOrNot;
