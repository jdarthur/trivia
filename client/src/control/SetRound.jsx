import React from 'react';
import sendData from "../index"

class SetRound extends React.Component {

    set_round = () => {
        const url = "/gameplay/session/" + this.props.session_id + "/current-round"
        const body = {
            player_id: this.props.player_id,
            round_id: this.props.target
        }

        sendData(url, "PUT", body)
        .then((data) => {
          console.log(data)
        })
    }

    render() {
        return (
            <div className="">
                <button onClick={this.set_round}> {this.props.label} </button>
            </div>
        );
    }
}

export default SetRound;