import React from 'react';
import sendData from "../index"
import AnsweredOrNot from "./AnsweredOrNot"
import CorrectOrNot from "./CorrectOrNot"
import "./Players.css"
import {Button, Modal} from 'antd';

interface Props {
    session_id: string
    player_id: string
    round_id: string | number | null | undefined
    question_id: string | number | null | undefined
    session_state: any
    scored: boolean
    is_mobile?: boolean
}

interface State {
    answers: any[]
    modal_open: boolean
}

class PlayerStatus extends React.Component<Props, State> {

    state: State = {
        answers: [],
        modal_open: false
    }

    // Ticket #146: a slow response for a previous question/round must not
    // overwrite the current one (WagerManager pattern).
    fetchCounter = 0

    componentDidMount() {
        const statusStored = JSON.parse(sessionStorage.getItem("status") || "null")
        if (statusStored) {
            this.setState({answers: statusStored}, () => this.get_answers())
        } else {
            this.get_answers()
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_answers()
        } else if (this.props.question_id !== prevProps.question_id) {
            this.get_answers()
        } else if (this.props.round_id !== prevProps.round_id) {
            this.get_answers()
        }
    }

    get_answers = () => {
        if (ready_to_call(this.props.round_id, this.props.question_id)) {
            this.fetchCounter += 1
            const currentFetch = this.fetchCounter

            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)

            console.log(this.props)
            sendData(url, "GET")
                .then((data: any) => {
                    console.log(data)
                    // Only apply if this is still the latest request.
                    if (currentFetch === this.fetchCounter) {
                        if (data.answers) {
                            sessionStorage.setItem("status", JSON.stringify(data.answers))
                            this.setState({answers: data.answers})
                        }
                    }
                })
        }
    }

    open_modal = () => {
        this.setState({modal_open: true})
    }
    close_modal = () => {
        this.setState({modal_open: false})
    }

    prevq = () => {

    }

    render() {

        const answers = this.state.answers?.map((player: any) => {

            if (this.props.scored)
                return <CorrectOrNot key={player.team_name} player_name={player.team_name}
                                     answers={player.answers} icon_name={player.icon}
                                     current_player={this.props.player_id} player_id={player.player_id}
                                     is_mobile={this.props.is_mobile}/>
            else return <AnsweredOrNot key={player.team_name} player_name={player.team_name}
                                       answered={player.answered} icon_name={player.icon}
                                       is_mobile={this.props.is_mobile}
                                       current_player={this.props.player_id} player_id={player.player_id}/>
        })

        const modal_answers = this.state.answers?.map((player: any) => {
            return <CorrectOrNot key={player.team_name} player_name={player.team_name}
                                 answers={player.answers} wager={player.wager} correct={player.correct}
                                 points_awarded={player.points_awarded} icon_name={player.icon}
                                 current_player={this.props.player_id} player_id={player.player_id}
                                 is_mobile={false}/>

        })
        const modal = <Modal title={null} open={this.state.modal_open} onCancel={this.close_modal}
                             centered={true} width='min(250px, 70vw)' footer={null}>
            <div> {modal_answers} </div>
        </Modal>

        return (
            <div>
                <div className="player-status-bar" onClick={this.open_modal}>
                    {answers}
                </div>
                {(this.props.is_mobile && this.props.scored) ? modal : null}

            </div>
        );
    }
}

function ready_to_call(round_id: string | number | null | undefined, question_id: string | number | null | undefined) {
    if (round_id === null) return false
    if (round_id === undefined) return false
    if (round_id === "") return false

    if (question_id === null) return false
    if (question_id === undefined) return false
    if (question_id === "") return false

    return true
}

export default PlayerStatus;
