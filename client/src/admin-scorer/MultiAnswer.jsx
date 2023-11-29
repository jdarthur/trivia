import React from 'react';
import "../players/Players.css"

import {Empty} from "antd"
import ShortTextWithPopover from "../common/ShortTextWithPopover";

class PlayerAnswer extends React.Component {

    render() {
        const last_answer = this.props.answers?.length > 0 ?
            this.props.answers[this.props.answers.length - 1] : null

        const realAnswerText = this.props.answers?.length > 0 && !this.props.omitWager ?
            `${last_answer?.answer} (wager: ${last_answer?.wager})`
            : `${last_answer?.answer}`

        const real_answer = this.props.answers?.length > 0 ?
            <div key={last_answer.id} style={{display: 'flex', justifyContent: 'center', margin: 5}}>
                <ShortTextWithPopover text={realAnswerText} maxLength={50}/>
            </div> :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                   style={{margin: 0}}/>


        const old_answers = <div className="multi-answer">
            {this.props.answers?.map((answer, index) => {
                let show = (index !== (this.props.answers.length - 1) && index > this.props.answers.length - 4)
                const answerAndWager = `${answer.answer} (wager: ${answer.wager})`
                return (show ? <span key={answer.answer_id} className="old-answer">
                    <ShortTextWithPopover text={answerAndWager} maxLength={20}/>
                 </span> : null)
            })}
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