import React from 'react';
import "./AnswerQuestion.css"
import sendData from "../index"
import SelectableWager from "./SelectableWager"

class WagerManager extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            available_wagers: [],
        }
    }

    componentDidMount() {
        this.get_available_wagers()
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.setState({ answer: "", wager: null, dirty: false }, () => this.get_available_wagers())
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_available_wagers()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_available_wagers()
        }
    }

    set_available_wagers = (resp) => {
        const available = []
        const avail_count = {}
        for (let i = 0; i < resp.length; i++) {
            const wager = resp[i]
            if (available.indexOf(resp[i]) === -1) {
                available.push(resp[i])
                avail_count[wager] = 1
            }
            else {
                avail_count[wager] += 1
            }
        }
        this.setState({ available_wagers: available, avail_count: avail_count })
    }

    get_available_wagers = () => {
        //get available wagers and truncate duplicates
        if (this.props.round_id !== "" && this.props.question_id !== "") {
            let url = "/gameplay/session/" + this.props.session_id + "/wagers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id

            console.log(url)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    this.set_available_wagers(data)
                })
        }
    }

    render() {
        const wagers = this.state.available_wagers.map(wager =>
            <SelectableWager key={wager} wager={wager} count={this.state.avail_count[wager]}
                select={this.props.select} selected={this.props.wager === wager} />)

        return (
            <div className="wager-manager">
                <div className="wager-title"> Wager: </div>
                <div className="selectable-wagers"> {wagers} </div>
            </div>
        );
    }
}

export default WagerManager;