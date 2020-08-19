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
        console.log("mount")
    }

    componentDidUpdate(prevProps) {
        printDiffs(this.props, prevProps)
        if (this.props.session_state !== prevProps.session_state) {
            this.get_available_wagers()
        }
        if (this.props.question_id !== prevProps.question_id) {
            this.get_available_wagers()
        }
        if (this.props.round_id !== prevProps.round_id) {
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
        available.sort()
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

        const can_wager = this.state.available_wagers.length > 0
        return (
            <div className="wager-manager">
                {can_wager ? <div className="section-top"> Wager: </div> : null }
                {can_wager ? <div className="selectable-wagers"> {wagers} </div> : null }
            </div>
        );
    }
}

function printDiffs(current, previous) {
    for (let key in current) {
        if (current[key] !== previous[key]) {
            console.log("update " + key + ", '" + previous[key] + "' -> '" + current[key] + "'")
        }
    }
}

export default WagerManager;