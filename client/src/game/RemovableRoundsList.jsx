import React from 'react';
// import './OpenRound.css';
import RoundInGame from "./RoundInGame"

class RemovableRoundsList extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            selected_rounds: []
        }
    }

    select_item = (round_id) => {
        const index = this.state.selected_rounds.indexOf(round_id)
        if (index === -1) {
            this.state.selected_rounds.push(round_id)
        }
        else {
            this.state.selected_rounds.splice(index, index + 1)
        }
        this.setState({ selected_rounds: this.state.selected_rounds })
    }

    remove_selected = () => {
        if (this.state.selected_rounds.length > 0) {
            this.props.remove_rounds(this.state.selected_rounds)
            this.setState({ selected_rounds: [] })
        }
    }


    render() {
        const rounds = this.props.rounds.map((round_id) => (
            <RoundInGame key={round_id} id={round_id} select={this.select_item}
                selected={this.state.selected_rounds.indexOf(round_id) !== -1}
            />))

        return (
            <div>
                Rounds:
                <div className="question-list">
                    {rounds}
                    <button onClick={this.remove_selected}> Remove Rounds</button>
                </div>
            </div>
        );
    }
}

export default RemovableRoundsList;