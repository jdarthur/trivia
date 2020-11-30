import React from 'react';
import './Lobby.css';
import PlayerIcon from "./PlayerIcon"
import ScorerLink from "../admin-scorer/ScorerLink"
import DeletePlayer from "./DeletePlayer"

import { Card } from 'antd';


class OtherPlayer extends React.Component {

  render() {
    const date = new Date(this.props.create_date);
    const dateString = date.toLocaleTimeString('en-US')
    const title = this.props.player_id ? <span >
      <span style={{ marginRight: 5 }}>
        <ScorerLink session_id={this.props.session_id} player_id={this.props.player_id} />
      </span>
      {this.props.real_name}
    </span>
      : this.props.real_name

    const icon = this.props.player_id ?
      <DeletePlayer session_id={this.props.session_id} player_id={this.props.player_id} admin_id={this.props.admin_id} /> :
      <PlayerIcon icon_name={this.props.icon_name} />
    return (
      <Card title={title} extra={icon}
        style={{ width: 200, margin: 5 }}>

        <span>
          <span style={{ fontStyle: 'italic' }}> {this.props.team_name} </span>
        </span>

        <p style={{ color: 'darkgrey', textAlign: 'right', marginBottom: 0 }}> joined {dateString} </p>
      </Card>
    )
  }
}

export default OtherPlayer;