import React from 'react';
import RemovableRound from './RemovableRound';

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
            <RemovableRound key={round_id} id={round_id} select={this.select_item}
                selected={this.state.selected_rounds.indexOf(round_id) !== -1}
                show_title={false} set_round_name={this.props.set_round_name}
                name={this.props.round_names[round_id]} handleKeyPress={this.props.handleKeyPress}/>))

        return (
            <div className="rem-question-list">
                {rounds}
                <button onClick={this.remove_selected}> Remove Rounds</button>
            </div>
        );
    }
}

export default RemovableRoundsList;