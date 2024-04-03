import React from 'react';
import './Homepage.css';
import NewGameModal from "./NewGameModal"
import GameLobby from "../lobby/GameLobby"
import ActiveGame from "../active/ActiveGame"

const SESSION_ID = "session_id"
const PLAYER_ID = "player_id"

class Homepage extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            session_id: "",
            player_id: "",
            sess_state: "",
            is_mod: false,
            started: false,
            rounds: [],
            fullRounds: []
        }
    }

    componentDidMount() {
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let session_id = params.get(SESSION_ID);
        let player_id = params.get(PLAYER_ID);

        const state = {}
        if (session_id) {
            state[SESSION_ID] = session_id
        }
        if (player_id) {
            state[PLAYER_ID] = player_id
        }

        //startedness is immutable... don't need to get from API after we know a game has started
        if (sessionStorage.getItem("started")) {
            state.started = true
        }
        if (sessionStorage.getItem("is_mod")) {
            state.is_mod = true
        }

        console.log(session_id)
        this.props.set_started(session_id !== null, state.is_mod)

        this.setState(state, () => this.get_session())
    }

    get_session_state = () => {
        if (this.state.session_id !== "") {
            let url = "/gameplay/session/" + this.state.session_id + "/state?current=" + this.state.sess_state
            fetch(url)
                .then(response => response.json())
                .then(state => {
                    console.log(state.state)
                    this.setState({sess_state: state.state}, () => this.get_session())
                })
        } else {
            console.log(this.state)
        }
    }

    get_session = () => {
        if (this.state.session_id !== "") {
            let url = "/gameplay/session/" + this.state.session_id
            if (this.state.player_id) {
                url = url + "?player_id=" + this.state.player_id
            }
            fetch(url)
                .then(response => response.json())
                .then(state => {
                    console.log(state)
                    const roundIndices = state.rounds ? state.rounds.map((round, index) => index) : []
                    const update = {
                        is_mod: state.mod !== undefined,
                        name: state.name,
                        started: !!state.started,
                        rounds: roundIndices,
                        fullRounds: state?.rounds
                    }

                    if (!sessionStorage.getItem("started") && state.started) {
                        sessionStorage.setItem("started", true)
                    }
                    if (!sessionStorage.getItem("is_mod") && update.is_mod) {
                        sessionStorage.setItem("is_mod", update.is_mod)
                    }

                    this.setState(update, () => this.get_session_state())
                })
        }
    }


    render() {
        const main = (this.state.started ?
            <ActiveGame session_id={this.state.session_id} player_id={this.state.player_id}
                        session_state={this.state.sess_state} is_mod={this.state.is_mod}
                        rounds={this.state.rounds} is_mobile={this.props.is_mobile}
                        fullRounds={this.state.fullRounds}/>
            :

            <GameLobby session_id={this.state.session_id} player_id={this.state.player_id}
                       session_state={this.state.sess_state} is_mod={this.state.is_mod}/>)
        return (
            <div className="homepage">
                {this.state.session_id === "" ? <NewGameModal token={this.props.token}/> : null}
                {this.state.session_id !== "" ? main : null}
            </div>
        );
    }
}

export default Homepage;