import React from 'react';
import './RoundList.css';

import Round from "./Round.jsx"
import OpenRound from "./OpenRound.jsx"
import EditorFilter from "../editor/EditorFilter.jsx"
import LoadingOrView from "../editor/LoadingOrView"

import {
    PlusSquareOutlined,
} from '@ant-design/icons';



//JSON keys
const NAME = "name"
const QUESTIONS = "questions"
const WAGERS = "wagers"
const ID = "id"
const NEW = "new"

class RoundList extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            unused_only: true,
            text_filter: "",
            rounds: [],
            selected: "", //selected round ID (1 at a time)
            dirty: "", //dirty round ID (can be selected_round or empty if a round is selected but not changed)
            loading: false
        }
    }

    componentDidMount() {
        this.get_rounds()
    }

    get_rounds = () => {
        let url = "/editor/rounds?"

        if (this.state.text_filter !== "") {
            url += "text_filter=" + this.state.text_filter
        }

        if (this.state.unused_only === true) {
            url += "&unused_only=true"
        }

        this.setState({ loading: true }, () => {
            fetch(url)
                .then(response => response.json())
                .then(state => {
                    console.log(state)
                    this.setState({ rounds: state.rounds, loading: false })
                })
        })
    }

    set_unused_only = (value) => {
        this.setState({ unused_only: value, selected: "" }, () => { this.get_rounds() })
    }

    set_text_filter = (value) => {
        this.setState({ text_filter: value, selected: "" }, () => { this.get_rounds() })
    }

    set_selected = (round_id, value) => {
        if (this.state.selected !== round_id) {
            this.save(this.state.selected)
            this.setState({ selected: round_id })
        }
        else if (!value) {
            this.save(this.state.selected)
            this.setState({ selected: "" })
        }
    }

    set_value = (round_id, key, value, save) => {
        const round = find(round_id, this.state.rounds)
        round[key] = value
        this.setState({ rounds: this.state.rounds, dirty: round_id }, () => {
            if (save) {
                this.save(round_id)
            }
        });
    }

    set_multi = (round_id, update_dict, save) => {
        const round = find(round_id, this.state.rounds)
        for (let key in update_dict) {
            round[key] = update_dict[key]
        }

        this.setState({ rounds: this.state.rounds, dirty: round_id }, () => {
            if (save) {
                this.save(round_id)
            }
        });
    }


    save = (round_id) => {
        //don't save if the selected round is not dirty
        if (this.state.dirty !== "") {
            const round = find(round_id, this.state.rounds)
            if (round_id === NEW) { //create new round
                console.log("create round", round)
                sendData(null, "POST", round)
                    .then((data) => {
                        round.id = data.id
                        this.setState({
                            rounds: this.state.rounds,
                            dirty: "",
                            selected: round.id
                        })
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
        if (round_id === NEW) {
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
        console.log(this.state.rounds)
        this.state.rounds.splice(index, 1)
        console.log(this.state.rounds)
        this.setState({ rounds: this.state.rounds, dirty: "", selected: "" })
    }

    /**
     * should we add the New Round button? => (true/false)
     */
    add_newround_button = () => {
        try {
            find(NEW, this.state.rounds)
            return false
        }
        catch (Error) { return this.state.loading === false }
    }

    /**
     * add a new empty round to the list
     */
    add_new_round = () => {
        const round = {
            [NAME]: "",
            [QUESTIONS]: [],
            [WAGERS]: [],
            [ID]: NEW
        }
        this.state.rounds.push(round)
        this.setState({ rounds: this.state.rounds }, () => {
            this.set_selected(NEW)
        })
    }


    render() {
        const rounds = this.state.rounds.map((round, index) => (
            <Round key={round.id} id={round.id} name={round.name} create_date={round.create_date}
                questions={round.questions} wagers={round.wagers}
                selected={(this.state.selected === round.id) ? true : false}
                set_selected={this.set_selected} delete={this.delete} />))

        const nrb = this.add_newround_button() ? <PlusSquareOutlined className="new_button" onClick={this.add_new_round} /> : null

        let open_round = null
        if (this.state.selected !== "") {
            const r = find(this.state.selected, this.state.rounds)
            open_round = <OpenRound key={r.id} id={r.id} name={r.name}
                questions={r.questions} wagers={r.wagers} set={this.set_value}
                set_selected={this.set_selected} delete={this.delete}
                save={this.save} set_multi={this.set_multi} />
        }
        return (
            <div className="round-and-open-question">
                <div className="ql_and_filter">
                    <EditorFilter set_text_filter={this.set_text_filter} set_unused_only={this.set_unused_only} data_type="rounds"
                        text_filter={this.state.text_filter} unused_only={this.state.unused_only} add_button={nrb} />

                    <LoadingOrView loading={this.state.loading} class_name="round_list"
                        empty={rounds?.length === 0} loaded_view={rounds} />
                </div>

                {open_round}
            </div>
        );
    }
}

function find(object_id, object_list) {
    if (object_id === '') {
        return null
    }
    for (const index in object_list) {
        const object = object_list[index]
        if (object.id === object_id) {
            return object
        }
    }
    throw new Error("Could not find object with ID '" + object_id + "'!")
}

async function sendData(round_id, method, round_data) {
    const url = "/editor/round" + (round_id != null ? "/" + round_id : "")
    let body = ""
    if (round_data !== undefined) {
        const r_copy = {
            [NAME]: round_data.name,
            [QUESTIONS]: round_data[QUESTIONS],
            [WAGERS]: round_data[WAGERS],
            //[ID]: NEW
        }
        body = JSON.stringify(r_copy)
    }


    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}

export default RoundList;
