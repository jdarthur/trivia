import React from 'react';

import { Card, InputNumber, Empty } from "antd"

import {
    CheckSquareOutlined,
    CloseSquareOutlined
} from '@ant-design/icons';

class PlayerAnswer extends React.Component {


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
        let answer_text = this.props.answer ? this.props.answer :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                style={{ margin: 0 }} />
        let override = this.props.correct === false ? 0 : this.props.override_value
        const wager = <div style={{ 'padding-left': '10px', 'font-size': '1.3em', 'font-weight': 'bold' }}>
            {this.props.wager}
        </div>

        return (

            <Card size="small" title={this.props.player_name} extra={wager}
                style={{ 'width': 200 }} bodyStyle={{ padding: 15 }}  >
                <div className="answered-or-not"> {answer_text} </div>

                {this.props.answer ?
                    <div className="score-and-override">
                        <div className="answer-scorer">
                            <div onClick={this.set_incorrect} className={incorrect_class}> <CloseSquareOutlined /> </div>
                            <div onClick={this.set_correct} className={correct_class}  > <CheckSquareOutlined /> </div>
                        </div>

                        <InputNumber value={override} onChange={this.set_override} />
                        {/* <Incrementer set={this.set_override} value={override}
                            disabled={this.props.correct === false}  /> */}
                    </div> : null}

            </Card>
        );
    }
}

export default PlayerAnswer;