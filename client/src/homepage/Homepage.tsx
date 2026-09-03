import React from 'react';
import './Homepage.css';
import NewGameModal from "./NewGameModal"
import GameLobby from "../lobby/GameLobby"
import ActiveGame from "../active/ActiveGame"
import type {RoundInGame} from "../types/models"

const SESSION_ID = "session_id"
const PLAYER_ID = "player_id"

interface Props {
    set_started: (started: boolean, isMod: boolean) => void
    is_mobile: boolean
    set_is_mod: (isMod: boolean) => void
    token: string
}

interface State {
    session_id: string
    player_id: string
    sess_state: any
    is_mod: boolean
    started: boolean
    rounds: number[]
    fullRounds: RoundInGame[]
    // The session's name, from GET /gameplay/session/:id. Already set by
    // get_session (it was untyped until the score-graph PNG export needed it
    // for a filename, ticket #240).
    name: string
}

class Homepage extends React.Component<Props, State> {

    // The session poll is a chained fetch loop (get_session_state → get_session →
    // get_session_state). `mounted` stops the loop once this component unmounts and
    // `pollController` cancels whichever request is in flight at that moment, so a
    // dead Homepage never keeps polling (and a remount never runs two loops at once).
    private mounted = true
    private pollController: AbortController | null = null

    constructor(props: Props) {
        super(props)
        this.state = {
            session_id: "",
            player_id: "",
            sess_state: "",
            is_mod: false,
            started: false,
            rounds: [],
            fullRounds: [],
            name: ""
        }
    }

    componentWillUnmount() {
        this.mounted = false
        this.pollController?.abort()
        this.pollController = null
    }

    componentDidMount() {
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let session_id = params.get(SESSION_ID);
        let player_id = params.get(PLAYER_ID);

        const state: any = {}
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
            this.pollController?.abort()
            const controller = new AbortController()
            this.pollController = controller
            fetch(url, {signal: controller.signal})
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Request failed (${response.status} ${response.statusText})`)
                    }
                    return response.json()
                })
                .then(state => {
                    if (!this.mounted) return
                    console.log(state.state)
                    this.setState({sess_state: state.state}, () => {
                        if (this.mounted) this.get_session()
                    })
                })
                .catch((err: any) => {
                    // AbortError fires on unmount (or when a newer request supersedes
                    // this one); the loop is intentionally dead in both cases.
                    if (err?.name === "AbortError") return
                    console.error("Failed to fetch session state:", err)
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
            this.pollController?.abort()
            const controller = new AbortController()
            this.pollController = controller
            fetch(url, {signal: controller.signal})
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Request failed (${response.status} ${response.statusText})`)
                    }
                    return response.json()
                })
                .then(state => {
                    if (!this.mounted) return
                    console.log(state)
                    const roundIndices = state.rounds ? state.rounds.map((round: any, index: number) => index) : []
                    const update: any = {
                        is_mod: state.mod !== undefined,
                        name: state.name,
                        started: !!state.started,
                        rounds: roundIndices,
                        fullRounds: state?.rounds
                    }

                    if (!sessionStorage.getItem("started") && state.started) {
                        sessionStorage.setItem("started", "true")
                    }
                    if (!sessionStorage.getItem("is_mod") && update.is_mod) {
                        sessionStorage.setItem("is_mod", update.is_mod)
                    }

                    this.setState(update, () => {
                        if (this.mounted) this.get_session_state()
                    })
                })
                .catch((err: any) => {
                    if (err?.name === "AbortError") return
                    console.error("Failed to fetch session:", err)
                })
        }
    }


    render() {
        const main = (this.state.started ?
            <ActiveGame session_id={this.state.session_id} player_id={this.state.player_id}
                        session_state={this.state.sess_state} is_mod={this.state.is_mod}
                        rounds={this.state.rounds} is_mobile={this.props.is_mobile}
                        session_name={this.state.name}
                        fullRounds={this.state.fullRounds}/>
            :

            <GameLobby session_id={this.state.session_id} player_id={this.state.player_id}
                       session_state={this.state.sess_state} is_mod={this.state.is_mod}
                       started={this.state.started}/>)
        return (
            <div className="homepage">
                {this.state.session_id === "" ? <NewGameModal token={this.props.token}/> : null}
                {this.state.session_id !== "" ? main : null}
            </div>
        );
    }
}

export default Homepage;
