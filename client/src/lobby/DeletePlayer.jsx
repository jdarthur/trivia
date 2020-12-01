import React from 'react';
import DeleteConfirm from "../editor/DeleteConfirm"

class ScorerLink extends React.Component {
    delete = () => {
        console.log("Delete session " + this.props.session_id + " / user " + this.props.player_id + " as admin " + this.props.admin_id)
        deletePlayer(this.props.session_id, this.props.player_id, this.props.admin_id)
    }

    render() { return <DeleteConfirm delete={this.delete} /> }
}

async function deletePlayer(session_id, player_id, admin_id) {
    const url = "/gameplay/session/" + session_id + "/remove"

    let body = JSON.stringify({
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

export default ScorerLink;