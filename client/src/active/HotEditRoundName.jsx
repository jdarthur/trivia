import React from 'react';
import '../question/Question.css';

class HotEditRoundName extends React.Component {

    state = {
        round_name: this.props.round_name
    }

    set_round_name = (event) => {
        this.setState({round_name: event.target.value})
    }

    save_self = () => {
        if (this.state.round_name !== this.props.round_name) {
            const body = {
                round_index: this.props.round_index,
                round_name: this.state.round_name
            }

            save(this.props.session_id, this.props.player_id, body).then((data) => {
                this.props.close()
            })
        }
        else {
            this.props.close()
        }
    }

    handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            this.save_self()
        }
    }

    render() {
        return (
            <input autoFocus value={this.state.round_name} onChange={this.set_round_name}
                   onKeyDown={this.handleKeyPress} placeholder="Round name" style={{width: 150}}/>
        );
    }
}

async function save(session_id, player_id, body) {
    const url = "/gameplay/session/" + session_id + "/hot-edit-round-name?player_id=" + player_id
    const response = await fetch(url, {
        method: "PUT",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    })
    return response.json()
}

export default HotEditRoundName