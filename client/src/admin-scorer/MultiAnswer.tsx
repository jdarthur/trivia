import React from 'react';
import "../players/Players.css"

import {Empty} from "antd"
import ShortTextWithPopover from "../common/ShortTextWithPopover";

interface AnswerLike {
    id?: string
    answer_id?: string
    answer: string
    wager: number
}

interface Props {
    answers?: AnswerLike[]
    omitWager?: boolean
}

class PlayerAnswer extends React.Component<Props> {

    render() {
        const answers = this.props.answers || []
        const last_answer = answers.length > 0 ? answers[answers.length - 1] : null

        const realAnswerText = answers.length > 0 && !this.props.omitWager ?
            `${last_answer?.answer} (wager: ${last_answer?.wager})`
            : `${last_answer?.answer}`

        const real_answer = answers.length > 0 ?
            <div key={last_answer?.id} style={{display: 'flex', justifyContent: 'center', margin: 5}}>
                <ShortTextWithPopover text={realAnswerText} maxLength={50}/>
            </div> :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                   style={{margin: 0}}/>


        const old_answers = <div className="multi-answer">
            {answers.map((answer, index) => {
                let show = (index !== (answers.length - 1) && index > answers.length - 4)
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
