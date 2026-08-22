import React from 'react';
import sendData from "../index"

import {Button} from "antd"

interface Props {
    session_id: string
    player_id: string
    target: number
    question_target?: number
    label: string
}

class SetRound extends React.Component<Props> {

    set_round = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-round"
        const body = {
            player_id: this.props.player_id,
            round_id: this.props.target,
            question_id: this.props.question_target,
        }

        sendData(url, "PUT", body)
            .then((data: any) => {
                console.log(data)
            })
    }


    render() {
        return (
            <Button type="primary" onClick={this.set_round}> {this.props.label} </Button>
        );
    }
}

export default SetRound;
