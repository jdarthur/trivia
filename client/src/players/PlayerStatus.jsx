import React from 'react';
import sendData from "../index"
import AnsweredOrNot from "./AnsweredOrNot"
import CorrectOrNot from "./CorrectOrNot"
import "./Players.css"
import { Modal } from 'antd';


class PlayerStatus extends React.Component {

    state = {
        answers: [],
        modal_open: false
    }

    componentDidMount() {
        const statusStored = JSON.parse(sessionStorage.getItem("status"))
        if (statusStored) {
            this.setState({ answers: statusStored }, () => this.get_answers())
        } else {
            this.get_answers()
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_answers()
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_answers()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_answers()
        }
    }

    get_answers = () => {
        if (ready_to_call(this.props.round_id, this.props.question_id)) {

            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)

            console.log(this.props)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    if (data.answers) {
                        sessionStorage.setItem("status", JSON.stringify(data.answers))
                        this.setState({ answers: data.answers })
                    }
                })
        }
    }

    open_modal = () => { this.setState({ modal_open: true }) }
    close_modal = () => { this.setState({ modal_open: false }) }

    render() {

        const answers = this.state.answers?.map(player => {

            if (this.props.scored)
                return <CorrectOrNot key={player.team_name} player_name={player.team_name}
                    answers={player.answers} wager={player.wager} correct={player.correct}
                    points_awarded={player.points_awarded} icon_name={player.icon}
                    current_player={this.props.player_id} player_id={player.player_id}
                    is_mobile={this.props.is_mobile} />
            else return <AnsweredOrNot key={player.team_name} player_name={player.team_name}
                answered={player.answered} icon_name={player.icon}
                current_player={this.props.player_id} player_id={player.player_id} />
        })

        const modal_answers = this.state.answers?.map(player => {
            return <CorrectOrNot key={player.team_name} player_name={player.team_name}
                answers={player.answers} wager={player.wager} correct={player.correct}
                points_awarded={player.points_awarded} icon_name={player.icon}
                current_player={this.props.player_id} player_id={player.player_id}
                is_mobile={false} />

        })
        const modal = <Modal title={null} visible={this.state.modal_open} onCancel={this.close_modal}
            centered={true} width='min(250px, 70vw)' footer={null} >
            <div> {modal_answers} </div>
        </Modal>

        return (
            <div>
                <div className="player-status-bar" onClick={this.open_modal}> {answers} </div>
                {(this.props.is_mobile && this.props.scored) ? modal : null}
            </div>
        );
    }
}

function ready_to_call(round_id, question_id) {
    if (round_id === null) return false
    if (round_id === undefined) return false
    if (round_id === "") return false

    if (question_id === null) return false
    if (question_id === undefined) return false
    if (question_id === "") return false

    return true
}

export default PlayerStatus;