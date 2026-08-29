import React from 'react';
import './RoundList.css';

import Round from "./Round"
import OpenRound from "./OpenRound"
import EditorFilter from "../editor/EditorFilter"
import ListPagination from "../editor/ListPagination";
import LoadingOrView from "../editor/LoadingOrView"
import NewButton from '../editor/NewButton';
import PageHeader from "../common/PageHeader";
import {buildListQuery, type ListMeta} from "../api/listParams";
import {Flex} from "antd";
import {OrderedListOutlined} from '@ant-design/icons';


//JSON keys
const NAME = "name"
const QUESTIONS = "questions"
const WAGERS = "wagers"
const ID = "id"
const NEW = "new"

interface Props {
    token: string
}

interface State {
    unused_only: boolean
    text_filter: string
    rounds: any[]
    selected: string //selected round ID (1 at a time)
    dirty: string //dirty round ID (can be selected_round or empty if a round is selected but not changed)
    loading: boolean
    // Pagination (ticket #195/196): the server returns one page plus the totals
    // for the filtered set. page is zero-based, as the API sees it.
    meta?: ListMeta
    page: number
    page_size: number
}

class RoundList extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            unused_only: true,
            text_filter: "",
            rounds: [],
            selected: "", //selected round ID (1 at a time)
            dirty: "", //dirty round ID (can be selected_round or empty if a round is selected but not changed)
            loading: false,
            page: 0,
            page_size: 25
        }
    }

    componentDidMount() {
        this.get_rounds()
    }

    get_rounds = () => {
        // One shared param builder for every editor list (ticket #195).
        const query = buildListQuery({
            unused_only: this.state.unused_only,
            text_filter: this.state.text_filter,
            page: this.state.page,
            page_size: this.state.page_size,
        })

        this.setState({loading: true}, () => {
            fetch("/editor/rounds" + query, {headers: {"borttrivia-token": this.props.token}})
                .then(response => response.json())
                .then(state => {
                    console.log(state)
                    const meta: ListMeta = {
                        total: state.total,
                        page: state.page,
                        page_size: state.page_size,
                        total_pages: state.total_pages,
                    }
                    // Deleting the last records can leave the current page past
                    // the end of the (smaller) filtered set; fall back to page 1
                    // so the list is never empty with no way back. The page-0
                    // rows are a different request, so re-fetch for them.
                    if (meta.page >= meta.total_pages && this.state.page > 0) {
                        this.setState({page: 0, loading: false}, () => this.get_rounds())
                        return
                    }
                    this.setState({
                        rounds: state.rounds,
                        meta: meta,
                        loading: false,
                    })
                })
        })
    }

    // Any filter change invalidates the current page, so reset to the first one.
    set_unused_only = (value: boolean) => {
        this.setState({unused_only: value, selected: "", page: 0}, () => {
            this.get_rounds()
        })
    }

    set_text_filter = (value: string) => {
        this.setState({text_filter: value, selected: "", page: 0}, () => {
            this.get_rounds()
        })
    }

    set_page = (page: number) => {
        this.setState({page, selected: ""}, () => {
            this.get_rounds()
        })
    }

    set_page_size = (page_size: number) => {
        this.setState({page_size, page: 0, selected: ""}, () => {
            this.get_rounds()
        })
    }

    set_selected = (round_id: string, value?: boolean) => {
        if (this.state.selected !== round_id) {
            this.save(this.state.selected)
            this.setState({selected: round_id})
        } else if (!value) {
            this.save(this.state.selected)
            this.setState({selected: ""})
        }
    }

    set_value = (round_id: string, key: string, value: any, save: boolean) => {
        const round = find(round_id, this.state.rounds)
        round[key] = value
        this.setState({rounds: this.state.rounds, dirty: round_id}, () => {
            if (save) {
                this.save(round_id)
            }
        });
    }

    set_multi = (round_id: string, update_dict: any, save: boolean) => {
        const round = find(round_id, this.state.rounds)
        for (let key in update_dict) {
            round[key] = update_dict[key]
        }

        this.setState({rounds: this.state.rounds, dirty: round_id}, () => {
            if (save) {
                this.save(round_id)
            }
        });
    }


    save = (round_id: string) => {
        //don't save if the selected round is not dirty
        if (this.state.dirty !== "") {
            const round = find(round_id, this.state.rounds)
            if (round_id === NEW) { //create new round
                console.log("create round", round)
                sendData(null, "POST", round, this.props.token)
                    .then((data) => {
                        round.id = data.id
                        this.setState({
                            rounds: this.state.rounds,
                            dirty: "",
                            selected: round.id
                        })
                    })
            } else { //update existing round
                console.log("save round", round)
                sendData(round_id, "PUT", round, this.props.token)
                    .then((data) => {
                        this.setState({dirty: ""})
                    })
            }
        }
    }

    delete = (round_id: string) => {
        const round = find(round_id, this.state.rounds)
        if (round_id === NEW) {
            this.delete_and_update_state(round)
        } else {
            console.log("delete round", round)
            sendData(round_id, "DELETE", undefined, this.props.token).then((data) => {
                this.delete_and_update_state(round)
            })
        }
    }

    /**
     * delete a round by value & update the state of the rounds list
     */
    delete_and_update_state = (round: any) => {
        const data = this.state.rounds.filter(item => item.id !== round.id);
        this.setState({rounds: data, dirty: "", selected: ""})
    }

    /**
     * should we add the New Round button? => (true/false)
     */
    add_newround_button = () => {
        try {
            find(NEW, this.state.rounds)
            return false
        } catch (Error) {
            return this.state.loading === false
        }
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

        const data = this.state.rounds ? [...this.state.rounds] : []
        data.push(round)
        this.setState({rounds: data}, () => {
            this.set_selected(NEW)
        })
    }


    render() {
        const rounds = this.state.rounds?.map((round, index) => (
            <Round key={round.id} id={round.id} name={round.name} create_date={round.create_date}
                   questions={round.questions} wagers={round.wagers}
                   selected={(this.state.selected === round.id)}
                   set_selected={this.set_selected} delete={this.delete}/>))

        const nrb = this.add_newround_button() ? <NewButton on_click={this.add_new_round}/> : null

        let open_round = null
        if (this.state.selected !== "") {
            const r = find(this.state.selected, this.state.rounds)
            open_round = <OpenRound key={r.id} id={r.id} name={r.name}
                                    questions={r.questions} wagers={r.wagers} set={this.set_value}
                                    set_selected={this.set_selected} delete={this.delete}
                                    save={this.save} set_multi={this.set_multi} token={this.props.token}/>
        }

        const header = <EditorFilter set_text_filter={this.set_text_filter} set_unused_only={this.set_unused_only}
                                     data_type="rounds"
                                     text_filter={this.state.text_filter} unused_only={this.state.unused_only}
                                     add_button={nrb}/>

        const view = <div
            style={{
                display: "flex",
                maxWidth: "100%",
                maxHeight: "100%",
                flexWrap: "wrap",
                overflowY: "auto"
            }}>
            {rounds}
            <ListPagination meta={this.state.meta} page={this.state.page}
                            pageSize={this.state.page_size}
                            set_page={this.set_page} set_page_size={this.set_page_size}/>
        </div>

        return (
            <div className="round-and-open-question">
                <div className="ql_and_filter">
                    <PageHeader breadcrumbs={["Editor", <><OrderedListOutlined/> Rounds</>]} header={header} style={{marginBottom: 10}}/>
                    <LoadingOrView loading={this.state.loading} class_name="round_list"
                                   empty={rounds?.length === 0} loaded_view={view}/>
                </div>

                {open_round}
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

async function sendData(round_id: string | null, method: string, round_data: any, token: string) {
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
        headers: {'Content-Type': 'application/json', "borttrivia-token": token},
        body: body
    })
    return response.json()
}

export default RoundList;
