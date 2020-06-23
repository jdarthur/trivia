import React from 'react';
import './ActiveGame.css';
// import InviteLink from "./InviteLink"
// import LobbyPlayer from "./LobbyPlayer"
// import OtherPlayers from "./OtherPlayers"

class ActiveGame extends React.Component {

  render() {
    return (
      <div className="lobby">
        we're in game wow
        {this.props.is_mod ? "youre the mod" : null}
        <div>
          {this.props.players}
        </div>
      </div>
    );
  }
}

export default ActiveGame;