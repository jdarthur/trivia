import React from 'react';

interface Props {
    session_id: string
    player_id: string
}

// LeaveGame lets a player self-leave a session mid-game (ticket #5): it flips
// their membership row to inactive (score/answers kept, no longer scored), then
// drops them back to the home screen.
export default function LeaveGame({session_id, player_id}: Props) {
    const leave = () => {
        const url = "/gameplay/session/" + session_id + "/leave"
        fetch(url, {
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({player_id})
        }).then(() => {
            sessionStorage.removeItem("session_id")
            sessionStorage.removeItem("player_id")
            sessionStorage.removeItem("started")
            sessionStorage.removeItem("is_mod")
            sessionStorage.removeItem("scoreboard")
            sessionStorage.removeItem("answers")
            sessionStorage.removeItem("status")
            window.location.href = window.location.origin + window.location.pathname
        })
    }
    return <button className="ant-btn ant-btn-dangerous" onClick={leave}>Leave game</button>
}
