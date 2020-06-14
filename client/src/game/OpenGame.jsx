import React from 'react';
import '../round/OpenRound.css';
import AddRoundsModal from './AddRoundsModal';
import RemovableRoundsList from "./RemovableRoundsList"

const NAME = "name"
const ROUNDS = "rounds"

class OpenGame extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value, false)
    }

    add_rounds = (rounds_list) => {
        this.props.set(this.props.id, ROUNDS, this.props.rounds.concat(rounds_list), true)
    }

    remove_rounds = (rounds_list) => {
        console.log(rounds_list)
        for (let i = 0; i < rounds_list.length; i++) {
            const index = this.props.rounds.indexOf(rounds_list[i])
            this.props.rounds.splice(index, index + 1)
        }
        this.props.set(this.props.id, ROUNDS, this.props.rounds, true)

    }

    delete_self = () => {
        this.props.delete(this.props.id)
    }

    save_self = () => {
        this.props.set_selected("")
    }

    handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.altKey) {
            event.preventDefault()
            this.save_self()
        }
    }

    render() {


        return (
            <div className="open-round">
                <input className={NAME} value={this.props.name}
                    onChange={this.set_name} onKeyDown={this.handleKeyPress} placeholder="Name" />

                <AddRoundsModal rounds={this.props.rounds} add_rounds={this.add_rounds} />
                <div>
                    <RemovableRoundsList rounds={this.props.rounds} remove_rounds={this.remove_rounds} />
                </div>

                <div>

                    <button onClick={this.delete_self} className="delete-button"> Delete </button>
                    <button onClick={this.save_self} > Save </button>
                </div>

            </div>


        );
    }
}

export default OpenGame;