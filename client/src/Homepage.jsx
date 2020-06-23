import React from 'react';
import './App.css';

class Homepage extends React.Component {
    render() {
        return (
            <div className="homepage">
                <button>New Game</button>
            </div>
        );
    }
}


async function createGame(method, question_data) {
    const url = "/api/question" + (question_id != null ? "/" + question_id : "")
    const body = (question_data === undefined) ? "" : JSON.stringify(question_data)
    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: body
    })
    return response.json()
}
export default Homepage;