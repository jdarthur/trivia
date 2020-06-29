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
        return (
            <div className="answer-and-scorer">
                <div className="player-answer">   
                    <div> { this.props.player_name } </div>
                    <div> { this.props.answer } </div>
                </div>
                <div className="answer-scorer">
                    <button onClick={this.set_correct}   className={correct_class}  > ☑ </button>
                    <button onClick={this.set_incorrect} className={incorrect_class}> ☒ </button>
                </div>
            </div>
        );
    }
}

export default PlayerAnswer;