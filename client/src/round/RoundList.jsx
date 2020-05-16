import React from 'react';
import './RoundList.css';

import Round from "./Round.jsx"


//JSON keys
const NAME = "name"
const QUESTIONS = "questions"
const WAGERS = "wagers"
const ID = "id"

class RoundList extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            rounds: [],
            selected: "", //selected round ID (1 at a time)
            dirty: "", //dirty round ID (can be selected_round or empty if a round is selected but not changed)
        }
    }

    componentDidMount() {
        this.get_rounds()
    }

    get_rounds = () => {
        let url = "/editor/rounds"

        fetch(url)
            .then(response => response.json())
            .then(state => {
                console.log("got rounds")
                console.log(state)
                this.setState({ rounds: state.rounds })
            })
    }

    set_selected = (round_id) => {
        switch (this.state.selected) {
            case "":
            case round_id: break
            case "new":
            default: this.save(this.state.selected)
        }

        this.setState({ selected: round_id });
    }

    set_value = (round_id, key, value) => {
        const round = find(round_id, this.state.rounds)
        round[key] = value
        this.setState({ rounds: this.state.rounds, dirty: round_id });
    }

    save = (round_id) => {
        //don't save if the selected round is not dirty
        if (this.state.dirty !== "") {
            const round = find(round_id, this.state.rounds)
            if (round_id === "new") { //create new round
                console.log("create round", round)
                sendData(null, "POST", round)
                    .then((data) => {
                        round.id = data.id
                        this.setState({ rounds: this.state.rounds, dirty: "" })
                    })
            }
            else { //update existing round
                console.log("save round", round)
                sendData(round_id, "PUT", round)
                    .then((data) => { this.setState({ dirty: "" }) })
            }
        }
    }

    delete = (round_id) => {
        const round = find(round_id, this.state.rounds)
        if (round_id === "new") {
            this.delete_and_update_state(round)
        }
        else {
            console.log("delete round", round)
            sendData(round_id, "DELETE").then((data) => {
                this.delete_and_update_state(round)
            })
        }
    }

    /**
     * delete a round by value & update the state of the rounds list
     */
    delete_and_update_state = (round) => {
        const index = this.state.rounds.map(function (e) { return e.id; }).indexOf(round.id);
        this.state.rounds.splice(index, index + 1)
        this.setState({ rounds: this.state.rounds, dirty: "" })
    }

    /**
     * should we add the New Round button? => (true/false)
     */
    add_newround_button = () => {
        try {
            find("new", this.state.rounds)
            return false
        }
        catch (Error) { return true }
    }

    /**
     * add a new empty round to the list
     */
    add_new_round = () => {
        const round = {
            [NAME]: "",
            [QUESTIONS]: "",
            [WAGERS]: "",
            [ID]: "new"
        }
        this.state.rounds.push(round)
        this.setState({ rounds: this.state.rounds }, () => {
            this.set_selected("new")
        })
    }


    render() {
        const rounds = this.state.rounds.map((round, index) => (

            <Round key={round.id} id={round.id} name={round.name} create_date={round.create_date}
                questions={round.questions} wagers={round.wagers}
                selected={(this.state.selected === round.id) ? true : false}
                set_selected={this.set_selected} set={this.set_value} delete={this.delete} />))

        const nrb = this.add_newround_button() ? <div className="new_round_button" onClick={this.add_new_round}>+</div> : null
        return (
            <div>
                Rounds:
                <div className="round_list">
                    {rounds}
                    {nrb}
                </div>
            </div>
        );
    }
}

function find(object_id, object_list) {
    for (const index in object_list) {
        const object = object_list[index]
        if (object.id === object_id) {
            return object
        }
    }
    throw new Error("Could not find object with ID '" + object_id + "'!")
}

async function sendData(round_id, method, round_data) {
    const url = "/editor/question" + (round_id != null ? "/" + round_id : "")
    const body = (round_data === undefined) ? "" : JSON.stringify(round_data)
    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}

export default RoundList;
