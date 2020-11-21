import React from 'react';
import './Lobby.css';
import PlayerIcon from "./PlayerIcon"
import ScorerLink from "../admin-scorer/ScorerLink"

import { Card } from 'antd';

class OtherPlayer extends React.Component {

  render() {
    const date = new Date(this.props.create_date);
    const dateString = date.toLocaleTimeString('en-US')
    const title = this.props.player_id ? <span>
      <ScorerLink />
      {this.props.real}
      </span>
      : null
    return (
      <Card title={title} extra={<PlayerIcon icon_name={this.props.icon_name} />}
        style={{ width: 200, margin: 5 }}>
        <p style={{ fontStyle: 'italic' }}> {this.props.team_name} </p>
        <p style={{ color: 'darkgrey', textAlign: 'right', marginBottom: 0 }}> joined {dateString} </p>
      </Card>
    )
  }
}

export default OtherPlayer;