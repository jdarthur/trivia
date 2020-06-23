import React from 'react';
import './Lobby.css';

class OtherPlayer extends React.Component {

  render() {
    return (
      <div className="lobby-player" >
        <div>{this.props.team_name}</div>
        <div>{this.props.real_name}</div>
      </div>
    )
  }
}

export default OtherPlayer;