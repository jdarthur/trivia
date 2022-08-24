import React from 'react';
import '../round/RoundList.css';

import Game from "./Game.jsx"
import OpenGame from "./OpenGame.jsx"
import NewButton from '../editor/NewButton';
import PageHeader from "../common/PageHeader";
import LoadingOrView from "../editor/LoadingOrView";

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


        fetch(url, {
            mode: 'cors',
            headers: new Headers({'Content-Type': 'application/json', 'borttrivia-token': this.props.token}),
        })
            .then(response => response.json())
            .then(state => {
                console.log("got games")
                console.log(state)
                this.setState({games: state.games})
            })
    }

    set_selected = (game_id) => {
        if (this.state.selected !== game_id) {
            this.save(this.state.selected, game_id)
        }
    }

    set_value = (game_id, key, value, save_game) => {
        const game = find(game_id, this.state.games)
        game[key] = value
        this.setState({games: this.state.games, dirty: game_id}, () => {
            if (save_game) {
                this.save(game_id)
            }
        });
    }

    set_multi = (game_id, update_dict, save, close) => {
        const games = [...this.state.games]

        const game = find(game_id, games)
        for (let key in update_dict) {
            game[key] = update_dict[key]
        }

        this.setState({games: games, dirty: game_id}, () => {
            if (save) this.save(game_id, close ? "" : game_id)
        })
    }

    set_round_name = (game_id, round_id, name) => {
        const game = find(game_id, this.state.games)
        game[ROUND_NAMES][round_id] = name
        this.setState({games: this.state.games, dirty: game_id})
    }

    save = (game_id, selected) => {
        //don't save if the selected game is not dirty
        console.log(this.state)
        if (this.state.dirty !== "") {
            const game = find(game_id, this.state.games)
            if (game_id === NEW) { //create new game
                console.log("create game", game)
                sendData(null, "POST", game, this.props.token)
                    .then((data) => {
                        game.id = data.id
                        const to_save = {games: this.state.games, dirty: ""}
                        if (selected) {
                            to_save.selected = game.id
                        } else {
                            to_save.selected = ""
                        }
                        console.log(to_save)

                        this.setState(to_save)
                    })
            } else { //update existing game
                console.log("save game", game)
                sendData(game_id, "PUT", game, this.props.token)
                    .then((data) => {
                        this.setState({dirty: "", selected: selected})
                    })
            }
        } else {
            this.setState({selected: selected})
        }
    }

    delete = (game_id) => {
        const game = find(game_id, this.state.games)
        if (game_id === NEW) {
            this.delete_and_update_state(game)
        } else {
            console.log("delete game", game)
            sendData(game_id, "DELETE", undefined, this.props.token).then((data) => {
                this.delete_and_update_state(game)
            })
        }
    }

    /**
     * delete a game by value & update the state of the game list
     */
    delete_and_update_state = (game) => {
        const index = this.state.games.map(function (e) {
            return e.id;
        }).indexOf(game.id);
        this.state.games.splice(index, 1)
        this.setState({games: this.state.games, dirty: "", selected: ""})
    }

    /**
     * should we add the New Game button? => (true/false)
     */
    add_newgame_button = () => {
        try {
            find(NEW, this.state.game)
            return false
        } catch (Error) {
            return true
        }
    }

    add_new_game = () => {

        const today = new Date()
        const label = today.getDate() + " " + today.toLocaleString('default', {month: 'long'}) + " " + today.getFullYear()

        const game = {
            [NAME]: label,
            [ROUNDS]: [],
            [ROUND_NAMES]: {},
            [ID]: NEW
        }
        this.state.games.push(game)
        this.setState({games: this.state.games}, () => {
            this.set_selected(NEW)
        })
    }


    render() {
        const games = this.state.games?.map((game, index) => (
            <Game key={game.id} id={game.id} name={game.name} create_date={game.create_date}
                  rounds={game.rounds} round_names={game.round_names}
                  selected={(this.state.selected === game.id)}
                  set_selected={this.set_selected} delete={this.delete}/>))

        const ngb = this.add_newgame_button() ?
            <NewButton on_click={this.add_new_game}/> : null

        let open_game = null
        if (this.state.selected !== "") {
            const g = find(this.state.selected, this.state.games)
            open_game = <OpenGame key={g.id} id={g.id} name={g.name}
                                  rounds={g.rounds} round_names={g.round_names} set={this.set_value}
                                  set_selected={this.set_selected} delete={this.delete}
                                  set_round_name={this.set_round_name} set_multi={this.set_multi}
                                  token={this.props.token}/>
        }
        return (
            <div className="round-and-open-question">
                <div className="ql_and_filter">
                    <PageHeader breadcrumbs={["Editor", "Games"]} header={ngb} style={{marginBottom: 10}}/>
                    <LoadingOrView class_name="round_list"
                                   empty={this.state.games?.length === 0} loaded_view={games} />
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

async function sendData(game_id, method, game_data, token) {
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
        mode: 'cors',
        method: method,
        headers: new Headers({'Content-Type': 'application/json', 'borttrivia-token': token}),
        body: body
    })
    return response.json()
}

export default GameList;
