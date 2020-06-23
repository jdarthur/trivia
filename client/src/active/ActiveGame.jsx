import React from 'react';
import './ActiveGame.css';
// import InviteLink from "./InviteLink"
// import LobbyPlayer from "./LobbyPlayer"
import ActiveQuestion from "./ActiveQuestion"

class ActiveGame extends React.Component {

  render() {
    return (
      <div className="lobby">
        <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id}/>
        we're in game wow123
        {this.props.is_mod ? "youre the mod" : null}
        <div>
          {this.props.players}
        </div>
      </div>
    );
  }
}

export default ActiveGame;