import React from 'react';
import "./Players.css"

import { Empty } from "antd"

class PlayerAnswer extends React.Component {

    render() {
        const last_answer = this.props.answers?.length > 0 ?
            this.props.answers[this.props.answers.length - 1] : null

        const real_answer = this.props.answers?.length > 0 ?
            <div key={last_answer.id} style={{ display: 'flex', justifyContent: 'center', margin: 5 }}>
                {last_answer.answer}
            </div> :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                style={{ margin: 0 }} />

        const old_answers = <div className="multi-answer">
            {this.props.answers?.map((answer, index) =>
                index === (this.props.answers.length - 1) ? null :
                    <span key={answer.answer_id} className="old-answer">
                        {answer.answer} ({answer.wager})
                     </span>)}
        </div>

        return (
            <div>
                {old_answers}
                {real_answer}
            </div>
        );
    }
}

export default PlayerAnswer;