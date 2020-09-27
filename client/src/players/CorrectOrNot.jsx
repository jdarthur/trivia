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

        // return (

           // (this.props.correct && this.props.points_awarded > 0 ? "": "in") + "correct"
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        const correct_icon = this.props.correct ? <CheckSquareOutlined /> : <CloseSquareOutlined />
        return (
            <Card size="small" title={this.props.player_name} extra={icon}
                style={{ 'min-width': 150 }} bodyStyle={{ padding: 0 }}  >
                {/* <div className="answered-or-not"> {answer_icon} </div> */}
                <div className="answer-text"> {this.props.answer} </div>
                <div className={class_name} >
                    <div> {amount_to_show} </div>
                    <div> {correct_icon} </div>

                    {/* <div onClick={this.set_incorrect} className={incorrect_class}> <CloseSquareOutlined /> </div> */}
                    {/* <div onClick={this.set_correct} className={correct_class}  > <CheckSquareOutlined /> </div> */}
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