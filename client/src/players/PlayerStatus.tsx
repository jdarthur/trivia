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
    question_type?: string
}

interface State {
    answers: any[]
    modal_open: boolean
    // Whether the status strip has more content to scroll left/right, so we can
    // show a fade edge hinting the strip is wider than the window.
    can_scroll_left: boolean
    can_scroll_right: boolean
}

class PlayerStatus extends React.Component<Props, State> {

    state: State = {
        answers: [],
        modal_open: false,
        can_scroll_left: false,
        can_scroll_right: false
    }

    // Ticket #146: a slow response for a previous question/round must not
    // overwrite the current one (WagerManager pattern).
    fetchCounter = 0

    // The scrollable strip; we read its scroll position to drive the fade edges.
    barRef = React.createRef<HTMLDivElement>()

    componentDidMount() {
        const statusStored = JSON.parse(sessionStorage.getItem("status") || "null")
        if (statusStored) {
            this.setState({answers: statusStored}, () => this.get_answers())
        } else {
            this.get_answers()
        }
        window.addEventListener("resize", this.update_fades)
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.update_fades)
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_answers()
        } else if (this.props.question_id !== prevProps.question_id) {
            this.get_answers()
        } else if (this.props.round_id !== prevProps.round_id) {
            this.get_answers()
        }
        // Recompute the fade edges whenever the box set or the window changes.
        if (prevState.answers !== this.state.answers) {
            this.update_fades()
        }
    }

    // Show a fade edge whenever the strip can still scroll in that direction.
    update_fades = () => {
        const el = this.barRef.current
        if (!el) {
            return
        }
        const can_scroll_left = el.scrollLeft > 1
        const can_scroll_right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
        if (can_scroll_left !== this.state.can_scroll_left || can_scroll_right !== this.state.can_scroll_right) {
            this.setState({can_scroll_left, can_scroll_right})
        }
    }

    on_scroll = () => {
        this.update_fades()
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
                .catch((error) => {
                    console.error("Failed to fetch answers:", error)
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
                                     session_id={this.props.session_id}
                                     question_type={this.props.question_type}
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
                                 session_id={this.props.session_id}
                                 question_type={this.props.question_type}
                                 is_mobile={false}/>

        })
        const modal = <Modal title={null} open={this.state.modal_open} onCancel={this.close_modal}
                             centered={true} width='min(250px, 70vw)' footer={null}>
            <div> {modal_answers} </div>
        </Modal>

        return (
            <div>
                <div className="player-status-wrap">
                    {this.state.can_scroll_left ? <div className="status-fade status-fade-left"/> : null}
                    <div className="player-status-bar" onClick={this.open_modal}
                         onScroll={this.on_scroll} ref={this.barRef}>
                        {answers}
                    </div>
                    {this.state.can_scroll_right ? <div className="status-fade status-fade-right"/> : null}
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
