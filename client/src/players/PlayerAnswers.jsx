import React from 'react';
import ScorerLink from "./ScorerLink.jsx"
import MultiAnswer from "./MultiAnswer"

import { Card, InputNumber } from "antd"

import {
    CheckSquareOutlined,
    CloseSquareOutlined
} from '@ant-design/icons';

class PlayerAnswer extends React.Component {


    componentDidUpdate(prevProps) {
        // console.log(prevProps)
        // console.log(this.props)
        if (prevProps.answers?.length > 1 && this.props.answers?.length > 1) {
            const previous_last_answer_id = (prevProps.answers[prevProps.answers.length - 1].answer_id)
            const new_last_answer_id = (this.props.answers[this.props.answers.length - 1].answer_id)
            if (previous_last_answer_id !== new_last_answer_id) {
                this.props.clear(this.props.player_id)
            }
        }
    }

    set_correct = () => {
        this.props.set_correct(this.props.player_id, true)
    }

    set_incorrect = () => {
        this.props.set_correct(this.props.player_id, false)
    }

    set_override = (value) => {
        console.log(value)
        this.props.set_override(this.props.player_id, value)
    }


    render() {
        const correct_class = "scorer-icon" + (this.props.correct === true ? " correct" : "")
        const incorrect_class = "scorer-icon" + (this.props.correct === false ? " incorrect" : "")

        let answer_text = <MultiAnswer answers={this.props.answers} />

        let override = this.props.correct === false ? 0 : this.props.override_value
        const wager = <div style={{ paddingLeft: '10px', fontSize: '1.3em', fontWeight: 'bold' }}>
            {this.props.answer?.length > 0 ? this.props.answers[this.props.answers.length - 1].wager : null }
        </div>

        const title = <div>
            {this.props.player_name}
            <ScorerLink session_id={this.props.session_id} player_id={this.props.player_id} />
        </div>
        return (

            <Card size="small" title={title} extra={wager}
                style={{ 'width': 200 }} bodyStyle={{ padding: 15 }}  >
                <div className="answered-or-not"> {answer_text} </div>

                {this.props.answers ?
                    <div className="score-and-override">
                        <div className="answer-scorer">
                            <div onClick={this.set_incorrect} className={incorrect_class}> <CloseSquareOutlined /> </div>
                            <div onClick={this.set_correct} className={correct_class}  > <CheckSquareOutlined /> </div>
                        </div>

                        { this.props.correct === true ? <InputNumber value={override} onChange={this.set_override} /> : null }
                    </div> : null}

            </Card>
        );
    }
}

export default PlayerAnswer;