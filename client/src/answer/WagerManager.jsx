import React from 'react';
import "./AnswerQuestion.css"
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
    }

    get_available_wagers = () => {
        //get available wagers and truncate duplicates
        const available = []
        const avail_count = {}
        const resp = [1, 2, 3, 1, 2, 3]
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