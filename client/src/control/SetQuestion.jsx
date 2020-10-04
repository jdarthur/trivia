import React from 'react';
import sendData from "../index"

import { Button } from "antd"

class SetQuestion extends React.Component {

    state = {
        loading: false
    }

    set_question = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-question"
        const body = {
            player_id: this.props.player_id,
            round_id: this.props.round_id,
            question_id: this.props.target
        }
        //TODO: come up with a better question ID solution
        this.setState({loading: true} , () => {
            sendData(url, "PUT", body)
            .then((data) => {
              console.log(data)
              this.setState({loading: false})
            })
        })
    }

    render() {
        return (
            <Button type="primary" onClick={this.set_question}> {this.props.label} </Button>
        );
    }
}

export default SetQuestion;