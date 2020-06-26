import React from 'react';
import sendData from "../index"

class NextQuestion extends React.Component {

    next_question = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-question"
        const body = {
            player_id: this.props.player_id,
            question_id: parseInt(this.props.next_question.replace("q", ""))
        }
        //TODO: come up with a better question ID solution
        sendData(url, "POST", body)
        .then((data) => {
          console.log(data)
        })
    }



    render() {
        return (
            <div className="">
                <button onClick={this.next_question}> Next Question </button>
            </div>
        );
    }
}

export default NextQuestion;