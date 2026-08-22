import React from 'react';
import '../round/OpenRound.css';
import AddRounds from './AddRounds';
import RemovableRoundsList from "./RemovableRoundsList"

import {Button, Modal, Tabs} from 'antd';

const {TabPane} = Tabs;

const NAME = "name"
const ROUNDS = "rounds"
const ROUND_NAMES = "round_names"

interface Props {
    id: string
    name: string
    rounds: string[]
    round_names: Record<string, string>
    set: (game_id: string, key: string, value: any, save_game: boolean) => void
    set_selected: (id: string) => void
    delete: (id: string) => void
    set_round_name: (game_id: string, round_id: string, name: string) => void
    set_multi: (game_id: string, update: any, save: boolean, close?: boolean) => void
    token: string
}

interface State {
    tab: number
    selected_rounds: string[]
}

class OpenGame extends React.Component<Props, State> {

    state: State = {
        tab: 1,
        selected_rounds: []
    }

    set_name = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.props.set(this.props.id, NAME, event.target.value, false)
    }

    set_round_name = (round_id: string, name: string) => {
        this.props.set_round_name(this.props.id, round_id, name)
    }

    set_rounds = (rounds_list: string[]) => {
        this.setState({selected_rounds: rounds_list})
    }

    add_rounds = (close?: boolean) => {
        for (let i = 0; i < this.state.selected_rounds.length; i++) {
            this.props.round_names[this.state.selected_rounds[i]] = "Round " + (i + 1)
        }
        const update = {
            [ROUNDS]: this.props.rounds.concat(this.state.selected_rounds),
            [ROUND_NAMES]: this.props.round_names
        }
        this.props.set_multi(this.props.id, update, !!close, close)
        this.setState({selected_rounds: []})
    }

    remove_rounds = (rounds_list: string[]) => {

        const data = [...this.props.rounds]
        let roundNames: Record<string, string> = {}
        roundNames = Object.assign(roundNames, this.props.round_names)
        this.setState({ rounds: data, dirty: "", selected: "" } as any)

        for (let i = 0; i < this.props.rounds.length; i++) {
            const index = data.indexOf(rounds_list[i])
            data.splice(index, index + 1)
            delete roundNames[rounds_list[i]]
        }

        const update = {
            [ROUNDS]: data,
            [ROUND_NAMES]: roundNames
        }
        this.props.set_multi(this.props.id, update, true)

    }

    delete_self = () => {
        this.props.delete(this.props.id)
    }

    save_and_close = () => {
        if (this.state.selected_rounds.length > 0) {
            this.add_rounds(true)
            return
        }
        this.props.set_selected("")
    }

    handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.altKey) {
            event.preventDefault()
            this.save_and_close()
        }
    }

    switch = (newTab: string) => {
        if (newTab === "edit") {
            this.add_rounds()
        }
    }

    render() {
        const footer = <div className="save-delete">
            <Button onClick={this.delete_self} className="button" danger> Delete game </Button>
            <Button type="primary" onClick={this.save_and_close} className="button"> Save </Button>
        </div>

        return (
            <Modal
                title="Edit Game"
                open={true}
                width="70vw"
                footer={footer}
                onCancel={this.save_and_close}>

                <div className="rem-question-list">
                    <div>
                        <Tabs defaultActiveKey="1" onChange={this.switch}>
                            <TabPane tab="Edit" key="edit">
                                <div>
                                    <input autoFocus className="round-name" value={this.props.name}
                                           onChange={this.set_name} onKeyDown={this.handleKeyPress}
                                           placeholder="Game name"/>

                                    <RemovableRoundsList rounds={this.props.rounds}
                                                         remove_rounds={this.remove_rounds}
                                                         set_round_name={this.set_round_name}
                                                         round_names={this.props.round_names}
                                                         handleKeyPress={this.handleKeyPress}
                                                         token={this.props.token}/>
                                </div>
                            </TabPane>

                            <TabPane tab="Add Rounds" key="add_rounds">
                                <AddRounds rounds={this.props.rounds}
                                           selected_rounds={this.state.selected_rounds}
                                           set_rounds={this.set_rounds} token={this.props.token} />
                            </TabPane>
                        </Tabs>
                    </div>
                </div>
            </Modal>


        )
            ;
    }
}

export default OpenGame;
