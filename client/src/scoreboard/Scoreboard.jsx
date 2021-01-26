import React from 'react';
import sendData from "../index"
import PlayerScore from "./PlayerScore"
import "./Scoreboard.css"

import { Modal, Button } from 'antd';

import {
    FundProjectionScreenOutlined
} from '@ant-design/icons';

class Scoreboard extends React.Component {

    state = {
        scores: [],
        open: false
    }

    componentDidMount() {
        const scoresStored = JSON.parse(sessionStorage.getItem("scoreboard"))
        if (scoresStored) {
            this.setState({ scores: scoresStored }, () => this.get_scoreboard())
        } else {
            this.get_scoreboard()
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_scoreboard()
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_scoreboard()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_scoreboard()
        }
    }

    get_scoreboard = () => {

        if (this.props.round_id !== "" && this.props.round_id !== null && this.props.round_id !== undefined) {

            let url = "/gameplay/session/" + this.props.session_id + "/scoreboard"
            url += "?player_id=" + this.props.player_id
            console.log(url)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    sessionStorage.setItem("scoreboard", JSON.stringify(data.scores))
                    this.setState({ scores: data.scores })
                })
        }
    }

    open = () => { this.setState({ open: true }) }

    close = () => { this.setState({ open: false }) }

    render() {
        const scores_sorted = this.state.scores?.sort((a, b) => {
            const score_a = sum(a.score)
            const score_b = sum(b.score)
            return (score_a > score_b) ? -1 : 1
        })

        const scores = scores_sorted.map((player, index) => {
            const background = ((index + 1) % 2) === 1 ? "#fafafa" : ""
            return <PlayerScore key={player.team_name} team_name={player.team_name}
                score={sum(player.score)} icon_name={player.icon} background={background}
                player_id={player.player_id} current_player={this.props.player_id} />
        })

        const marginLeft = this.props.is_mobile ? 0 : 100
        const scoreboard = <div className="scoreboard" style={{ marginLeft: marginLeft }}>
            <div className="scoreboard-title">
                <span style={{ paddingRight: 10 }}>Scoreboard</span>
                <FundProjectionScreenOutlined />
            </div>
            {scores}
        </div>

        const openModalButton = this.state.open ? null :
            <Button onClick={this.open} style={{position: 'absolute', top: 15, right: 0, height: '3em' }}>
                <FundProjectionScreenOutlined />
            </Button>

        const modal = <Modal title={null} visible={this.state.open}
            onCancel={this.close} centered={true} width='min(250px, 70vw)' footer={null} >
            <div> {scoreboard} </div>
        </Modal>

        return (<div>
            {this.props.is_mobile ? <div>
                <div> {openModalButton} </div>
                {modal}
            </div> : scoreboard}

        </div>)
    }
}

function sum(list) {
    return (list || []).reduce(function (a, b) { return a + b; }, 0);
}

export default Scoreboard;