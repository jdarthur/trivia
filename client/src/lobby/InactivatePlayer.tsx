import React from 'react';
import DeleteConfirm from "../editor/DeleteConfirm"

interface Props {
    session_id: string
    player_id: string
    admin_id: string
}

// InactivatePlayer is the mod-only "boot" action for a started session (ticket
// #5): it flips the target's membership to inactive (keeping the row and score)
// rather than hard-removing them.
class InactivatePlayer extends React.Component<Props> {
    inactivate = () => {
        console.log("Boot " + this.props.player_id + " from session " + this.props.session_id + " as admin " + this.props.admin_id)
        inactivatePlayer(this.props.session_id, this.props.player_id, this.props.admin_id)
    }

    render() { return <DeleteConfirm delete={this.inactivate} /> }
}

async function inactivatePlayer(session_id: string, player_id: string, admin_id: string) {
    const url = "/gameplay/session/" + session_id + "/inactivate"

    const body = JSON.stringify({
        admin_id: admin_id,
        player_id: player_id,
    })

    const response = await fetch(url, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}

export default InactivatePlayer;
