import React from 'react';
import './Question.css';
/**
 * This is a more concise version of a question that
 * can be nested inside of a round. It shows a fixed-length
 * portion of the question in a wider view 
 */
const MAX_LEN = 35 //max chars to show before ellipsis
class ConciseReadOnlyQuestion extends React.Component {

    render() {
        let cutoff = this.props.cutoff ? this.props.cutoff : MAX_LEN; 
        let text = this.props.question
        if (this.props.question.length > cutoff) {
            text = this.props.question.substring(0, cutoff) + "..."
        }

        return (
            <div className="concise-question">
                {text}
            </div>
        );
    }
}

export default ConciseReadOnlyQuestion
