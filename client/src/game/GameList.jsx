import React from 'react';
import '../round/RoundList.css';

import Game from "./Game.jsx"
import OpenGame from "./OpenGame.jsx"


//JSON keys
const NAME = "name"
const ROUNDS = "rounds"
const ROUND_NAMES = "round_names"
const ID = "id"
const NEW = "new"

class GameList extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            games: [],
            selected: "",
            dirty: "",
        }
    }

    componentDidMount() {
        this.get_games()
    }

    get_games = () => {
        let url = "/editor/games"

        fetch(url)
            .then(response => response.json())
            .then(state => {
                console.log("got games")
                console.log(state)
                this.setState({ games: state.games })
            })
    }

    set_selected = (game_id) => {
        if (this.state.selected !== game_id) {
            this.save(this.state.selected)
            this.setState({ selected: game_id })
        }
    }

    set_value = (game_id, key, value) => {
        const round = find(game_id, this.state.games)
        round[key] = value
        this.setState({ rounds: this.state.games, dirty: game_id });
    }

    save = (game_id) => {
        //don't save if the selected game is not dirty
        if (this.state.dirty !== "") {
            const game = find(game_id, this.state.games)
            if (game_id === NEW) { //create new game
                console.log("create game", game)
                sendData(null, "POST", game)
                    .then((data) => {
                        game.id = data.id
                        this.setState({ games: this.state.games, dirty: "" })
                    })
            }
            else { //update existing game
                console.log("save game", game)
                sendData(game_id, "PUT", game)
                    .then((data) => { this.setState({ dirty: "" }) })
            }
        }
    }

    delete = (game_id) => {
        const game = find(game_id, this.state.games)
        if (game_id === NEW) {
            this.delete_and_update_state(game)
        }
        else {
            console.log("delete game", game)
            sendData(game_id, "DELETE").then((data) => {
                this.delete_and_update_state(game)
            })
        }
    }

    /**
     * delete a game by value & update the state of the game list
     */
    delete_and_update_state = (game) => {
        const index = this.state.games.map(function (e) { return e.id; }).indexOf(game.id);
        this.state.games.splice(index, index + 1)
        this.setState({ games: this.state.games, dirty: "", selected: "" })
    }

    /**
     * should we add the New Game button? => (true/false)
     */
    add_newgame_button = () => {
        try {
            find(NEW, this.state.game)
            return false
        }
        catch (Error) { return true }
    }

    add_new_game = () => {
        const game = {
            [NAME]: "",
            [ROUNDS]: [],
            [ROUND_NAMES]: {},
            [ID]: NEW
        }
        this.state.games.push(game)
        this.setState({ games: this.state.games }, () => {
            this.set_selected(NEW)
        })
    }


    render() {
        const games = this.state.games.map((game, index) => (
            <Game key={game.id} id={game.id} name={game.name} create_date={game.create_date}
                rounds={game.rounds} round_names={game.round_names}
                selected={(this.state.selected === game.id) ? true : false}
                set_selected={this.set_selected} delete={this.delete} />))

        const ngb = this.add_newgame_button() ? <div className="new_button" onClick={this.add_new_game}>+</div> : null

        let open_game = null
        if (this.state.selected !== "") {
            const g = find(this.state.selected, this.state.games)
            open_game = <OpenGame key={g.id} id={g.id} name={g.name}
                rounds={g.rounds} round_names={g.round_names} set={this.set_value}
                set_selected={this.set_selected} delete={this.delete} />
        }
        return (
            <div className="round-and-open-question">
                <div className="round_list">
                    {games}
                    {ngb}
                </div>
                {open_game}
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

async function sendData(game_id, method, game_data) {
    const url = "/editor/game" + (game_id != null ? "/" + game_id : "")
    let body = ""
    if (game_data !== undefined) {
        const g_copy = {
            [NAME]: game_data.name,
            [ROUNDS]: game_data[ROUNDS],
            [ROUND_NAMES]: game_data[ROUND_NAMES],
        }
        body = JSON.stringify(g_copy)
    }


    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}

export default GameList;
