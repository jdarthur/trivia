import React from 'react';
import '../round/OpenRound.css';
import AddRoundsModal from './AddRoundsModal';
import RemovableRoundsList from "./RemovableRoundsList"

import { Collapse, Button } from 'antd';
const { Panel } = Collapse;

const NAME = "name"
const ROUNDS = "rounds"
const ROUND_NAMES = "round_names"

class OpenGame extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value, false)
    }

    set_round_name = (round_id, name) => {
        this.props.set_round_name(this.props.id, round_id, name)
    }

    add_rounds = (rounds_list) => {
        for (let i = 0; i < rounds_list.length; i++) {
            this.props.round_names[rounds_list[i]] = "Round " + (i + 1)
        }
        const update = {
            [ROUNDS]: this.props.rounds.concat(rounds_list),
            [ROUND_NAMES]: this.props.round_names
        }
        this.props.set_multi(this.props.id, update, true)
    }

    remove_rounds = (rounds_list) => {
        console.log(rounds_list)
        for (let i = 0; i < rounds_list.length; i++) {
            const index = this.props.rounds.indexOf(rounds_list[i])
            this.props.rounds.splice(index, index + 1)
            delete this.props.round_names[rounds_list[i]]
        }

        const update = {
            [ROUNDS]: this.props.rounds,
            [ROUND_NAMES]: this.props.round_names
        }
        this.props.set_multi(this.props.id, update, true)

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

                <div className="open-header"> Edit Game </div>
                <div className="current-questions">
                    <input className="round-name" value={this.props.name}
                        onChange={this.set_name} onKeyDown={this.handleKeyPress} placeholder="Game name" />
                    <AddRoundsModal rounds={this.props.rounds} add_rounds={this.add_rounds} />
                </div>

                <Collapse defaultActiveKey={['1']} style={{ width: "100%" }}>
                    <Panel header="Rounds" key="1">
                        <RemovableRoundsList rounds={this.props.rounds} remove_rounds={this.remove_rounds}
                            set_round_name={this.set_round_name} round_names={this.props.round_names}
                            handleKeyPress={this.handleKeyPress} />
                    </Panel>
                </Collapse>

                <div className="save-delete">
                    <Button onClick={this.delete_self} className="button" danger> Delete game </Button>
                    <Button onClick={this.save_self} className="button" > Save </Button>
                </div>

            </div>


        );
    }
}

export default OpenGame;