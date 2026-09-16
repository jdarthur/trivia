import React from 'react';
import '../round/RoundList.css';
import '../editor/EditorList.css';

import {Table, Tag} from 'antd';
import {EditOutlined, TrophyOutlined} from '@ant-design/icons';
import OpenGame from "./OpenGame"
import NewButton from '../editor/NewButton';
import PageHeader from "../common/PageHeader";
import LoadingOrView from "../editor/LoadingOrView";
import EditorFilter from "../editor/EditorFilter";
import DeleteConfirm from "../editor/DeleteConfirm";
import ListPagination from "../editor/ListPagination";
import type {ListMeta} from "../api/listParams";

// Default rows per page for the table pager, matching the other editor lists.
const PAGE_SIZE = 10

//JSON keys
const NAME = "name"
const ROUNDS = "rounds"
const ROUND_NAMES = "round_names"
const ID = "id"
const NEW = "new"

interface Props {
    token: string
}

interface State {
    games: any[]
    selected: string
    dirty: string
    game: any
    loading: boolean
    text_filter: string
    page: number
    page_size: number
}

class GameList extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            games: [],
            selected: "",
            dirty: "",
            game: undefined,
            loading: true,
            text_filter: "",
            page: 0,
            page_size: PAGE_SIZE,
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
                // Newest first: create_date is a fixed-width UTC string, so a
                // plain string compare orders it chronologically. Sort once at
                // fetch so the inline editor's full list and the paged view
                // agree.
                const games = (state.games || []).slice().sort((a: any, b: any) =>
                    (b.create_date || "").localeCompare(a.create_date || ""))
                this.setState({games, loading: false})
            })
            .catch(() => {
                this.setState({loading: false})
            })
    }

    set_text_filter = (value: string) => {
        // A different filter is a different row set, so the current page may not
        // exist any more — start back at the top (same as the other lists).
        this.setState({text_filter: value, page: 0})
    }

    set_page = (page: number) => {
        this.setState({page})
    }

    set_page_size = (page_size: number) => {
        this.setState({page_size, page: 0})
    }

    /**
     * client-side name filter for the table. The list is fetched whole (the
     * inline OpenGame editor needs the full game object, so the row set can't
     * be a filtered server page), so filtering happens here on the full list
     * while `games` stays intact for the editor.
     */
    filter_games = (games: any[], text: string) => {
        if (!text) {
            return games
        }
        const needle = text.toLowerCase()
        return games.filter((game) => (game.name || "").toLowerCase().includes(needle))
    }

    set_selected = (game_id: string) => {
        if (this.state.selected !== game_id) {
            this.save(this.state.selected, game_id)
        }
    }

    set_value = (game_id: string, key: string, value: any, save_game: boolean) => {
        const game = find(game_id, this.state.games)
        game[key] = value
        this.setState({games: this.state.games, dirty: game_id}, () => {
            if (save_game) {
                this.save(game_id)
            }
        });
    }

    set_multi = (game_id: string, update_dict: any, save: boolean, close?: boolean) => {
        const games = [...this.state.games]

        const game = find(game_id, games)
        for (let key in update_dict) {
            game[key] = update_dict[key]
        }

        this.setState({games: games, dirty: game_id}, () => {
            if (save) this.save(game_id, close ? "" : game_id)
        })
    }

    set_round_name = (game_id: string, round_id: string, name: string) => {
        const game = find(game_id, this.state.games)
        game[ROUND_NAMES][round_id] = name
        this.setState({games: this.state.games, dirty: game_id})
    }

    save = (game_id: string, selected?: string) => {
        //don't save if the selected game is not dirty
        console.log(this.state)
        if (this.state.dirty !== "") {
            const game = find(game_id, this.state.games)
            if (game_id === NEW) { //create new game
                console.log("create game", game)
                sendData(null, "POST", game, this.props.token)
                    .then((data) => {
                        game.id = data.id
                        const to_save: any = {games: this.state.games, dirty: ""}
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
                        this.setState({dirty: "", selected: selected as string})
                    })
            }
        } else {
            this.setState({selected: selected as string})
        }
    }

    delete = (game_id: string) => {
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
    delete_and_update_state = (game: any) => {
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
        const displayed_games = this.filter_games(this.state.games || [], this.state.text_filter)

        // Client-side paging (ticket #288): the inline OpenGame editor needs the
        // full game objects, so the whole list stays in state and we only slice
        // for display. The pager is the shared ListPagination footer, and the
        // table body scrolls inside .table_and_pager (see EditorList.css), so the
        // footer always stays reachable below a tall list.
        const total = displayed_games.length
        const total_pages = Math.max(1, Math.ceil(total / this.state.page_size))
        // Clamp so deleting the last rows on a later page can't leave us on an
        // empty page with no way back.
        const page = Math.min(this.state.page, total_pages - 1)
        const paged_games = displayed_games.slice(page * this.state.page_size,
            page * this.state.page_size + this.state.page_size)
        const meta: ListMeta = {total, page, page_size: this.state.page_size, total_pages}

        const ngb = this.add_newgame_button() ?
            <NewButton on_click={this.add_new_game}/> : null

        const columns = [
            {title: "", width: '5em', render: (_: any, game: any) => (
                <span style={{fontSize: '1.2em'}}>
                    <DeleteConfirm delete={() => this.delete(game.id)} style={{paddingRight: 10}}/>
                    <EditOutlined onClick={() => this.set_selected(game.id)}/>
                </span>
            )},
            {title: 'Name', dataIndex: 'name', ellipsis: {showTitle: false},
             render: (name: string, game: any) => (
                 <span onClick={() => this.set_selected(game.id)}>
                     {name === '' ? '[unnamed game]' : name}
                 </span>
             )},
            {title: 'Rounds', dataIndex: 'rounds', render: (rounds: string[]) => rounds?.length || 0},
            {title: 'Used in active sessions', dataIndex: 'active_sessions',
             render: (active_sessions: number) => (
                 <Tag color={active_sessions > 0 ? 'green' : 'default'}>
                     {active_sessions > 0 ? active_sessions : "No"}
                 </Tag>
             )},
        ]

        const table = <div className="table_and_pager">
            <Table columns={columns} dataSource={paged_games} pagination={false}
                   size="small" rowKey="id"/>
            <ListPagination meta={meta} page={page} pageSize={this.state.page_size}
                            set_page={this.set_page} set_page_size={this.set_page_size}/>
        </div>

        const header = <EditorFilter set_text_filter={this.set_text_filter}
                                     set_unused_only={() => {}} data_type="games"
                                     text_filter={this.state.text_filter}
                                     unused_only={false} add_button={ngb}
                                     show_unused_only={false}/>

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
                    <PageHeader breadcrumbs={["Editor", <><TrophyOutlined/> Games</>]} header={header} style={{marginBottom: 10}}/>
                    <LoadingOrView loading={this.state.loading} class_name="round_list"
                                   empty={this.state.games?.length === 0} loaded_view={table} />
                </div>
                {open_game}
            </div>
        );
    }
}

function find(object_id: string, object_list: any[]) {
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

async function sendData(game_id: string | null, method: string, game_data: any, token: string) {
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
