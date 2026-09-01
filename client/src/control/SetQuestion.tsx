import React from 'react';
import sendData from "../index"

import { Button } from "antd"

interface Props {
    session_id: string
    player_id: string
    round_id: string | number
    target: number
    label: string
    // Leading icon for the moderator's control card (e.g. <LeftOutlined/>).
    icon?: React.ReactNode
}

interface State {
    loading: boolean
}

class SetQuestion extends React.Component<Props, State> {

    state: State = {
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
            .then((data: any) => {
              console.log(data)
            })
            .catch((error: any) => {
              console.log(error)
            })
            .finally(() => {
              this.setState({loading: false})
            })
        })
    }

    render() {
        // aria-label keeps the accessible name to just the label: the icon's
        // own aria-label would otherwise be read out as part of the button.
        return (
            <Button onClick={this.set_question} disabled={this.state.loading}
                    icon={this.props.icon} aria-label={this.props.label}>
                {this.props.label}
            </Button>
        );
    }
}

export default SetQuestion;
