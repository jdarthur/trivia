import React from 'react';
import sendData from "../index"

class SetQuestion extends React.Component {

    set_question = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-question"
        const body = {
            player_id: this.props.player_id,
            question_id: parseInt(this.props.target.replace("q", ""))
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