import React from 'react';
import sendData from "../index"

class SetQuestion extends React.Component {

    set_question = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-question"
        const body = {
            player_id: this.props.player_id,
            round_id: this.props.round_id,
            question_id: this.props.target
        }
        //TODO: come up with a better question ID solution
        sendData(url, "PUT", body)
        .then((data) => {
          console.log(data)
        })
    }

    render() {
        return (
            <div className="">
                <button onClick={this.set_question}> {this.props.label} </button>
            </div>
        );
    }
}

export default SetQuestion;