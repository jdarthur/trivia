import React from 'react';
import './Lobby.css';
import InviteLink from "./InviteLink"
import LobbyPlayer from "./LobbyPlayer"
import OtherPlayers from "./OtherPlayers"

import {Layout, Button, Breadcrumb} from 'antd';
import {PlaySquareOutlined} from '@ant-design/icons';

class GameLobby extends React.Component {
    state = {excluded_icons: []}
    set_excluded_icons = (excluded_icons) => {
        this.setState({excluded_icons: excluded_icons})
    }

    start = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/start"
        sendData(url, "POST", {player_id: this.props.player_id})
            .then((data) => {
                console.log(data)
            })
    }

    render() {

        const otherPlayersTitle = this.props.is_mod ? "Players:" : "Other Players:"

        return (
            <Layout>
                <Breadcrumb style={{padding: 10}}>
                    <Breadcrumb.Item>
                        <PlaySquareOutlined/>
                    </Breadcrumb.Item>
                    <Breadcrumb.Item> Lobby </Breadcrumb.Item>
                </Breadcrumb>

                <div style={{margin: 10, display: "flex", alignItems: "center"}}>
                    {this.props.is_mod ? <InviteLink session_id={this.props.session_id}/> : null}
                    {this.props.is_mod ? <Button type="primary" onClick={this.start} className="start-button"> Start
                        Game </Button> : null}
                    {this.props.is_mod ? null : <LobbyPlayer session_id={this.props.session_id}
                                                             player_id={this.props.player_id}
                                                             excluded_icons={this.state.excluded_icons}/>}
                </div>
                <br/>
                <span style={{marginLeft: 10}}>{otherPlayersTitle}</span>

                <div className="game-lobby">
                    <OtherPlayers player_id={this.props.player_id} session_id={this.props.session_id}
                                  session_state={this.props.session_state}
                                  set_excluded_icons={this.set_excluded_icons}/>
                </div>
            </Layout>
        );
    }
}

async function sendData(url, method, data) {
    let body
    if (data !== undefined) {
        const copy = Object.assign({}, data)
        delete copy.id
        delete copy.create_date
        body = JSON.stringify(copy)
    }

    const response = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: body
    })
    return response.json()
}

export default GameLobby;