import React from 'react';
class PlayerAnswer extends React.Component {


    set_correct = () => {
        this.props.set_correct(this.props.player_id, true)
    }

    set_incorrect = () => {
        this.props.set_correct(this.props.player_id, false)
    }


    render() {
        const correct_class = "set-score" + (this.props.correct === true ? " correct" : "")
        const incorrect_class = "set-score" + (this.props.correct === false ? " incorrect" : "")
        let answer_text = this.props.answer ? this.props.answer + " (" + this.props.wager + ")" : "[no answer]"

        return (
            <div className="answer-and-scorer">
                <div className="player-answer">
                    <div className="team-name"> { this.props.player_name } </div>
                    <div className="answer-text">    {answer_text}      </div>
                </div>
                { this.props.answer ? <div className="answer-scorer">
                    <div onClick={this.set_incorrect} className={incorrect_class}> ✗ </div>
                    <button onClick={this.set_correct}   className={correct_class}  > ✓ </button>
                </div>: null}
            </div>
        );
    }
}

export default PlayerAnswer;