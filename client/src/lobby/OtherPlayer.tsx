import React from 'react';
import './Lobby.css';
import PlayerIcon from "./PlayerIcon"
import ScorerLink from "../admin-scorer/ScorerLink"
import DeletePlayer from "./DeletePlayer"
import InactivatePlayer from "./InactivatePlayer"

import { Card } from 'antd';

interface Props {
  team_name: string
  real_name: string
  create_date: string
  icon_name: string
  player_id: string
  session_id: string
  admin_id: string
  started: boolean
  active?: boolean
}

class OtherPlayer extends React.Component<Props> {

  render() {
    const date = new Date(this.props.create_date);
    const dateString = date.toLocaleTimeString('en-US')
    const inactive = this.props.active === false
    const title = this.props.player_id ? <span >
      <span style={{ marginRight: 5 }}>
        <ScorerLink session_id={this.props.session_id} player_id={this.props.player_id} />
      </span>
      {this.props.real_name}
    </span>
      : this.props.real_name

    // During a started session the mod's per-player action is a boot
    // (inactivate, keeps the row/score); pre-start it is a hard remove.
    const icon = this.props.player_id ?
      (this.props.started ?
        <InactivatePlayer session_id={this.props.session_id} player_id={this.props.player_id} admin_id={this.props.admin_id} /> :
        <DeletePlayer session_id={this.props.session_id} player_id={this.props.player_id} admin_id={this.props.admin_id} />) :
      <PlayerIcon icon_name={this.props.icon_name} />
    return (
      <Card title={title} extra={icon}
        style={{ width: 200, margin: 5, opacity: inactive ? 0.5 : 1 }}>

        <span style={inactive ? { filter: 'grayscale(1)', textDecoration: 'line-through' } : undefined}>
          <span style={{ fontStyle: 'italic' }}> {this.props.team_name} </span>
        </span>

        <p style={{ color: 'darkgrey', textAlign: 'right', marginBottom: 0 }}> joined {dateString} </p>
      </Card>
    )
  }
}

export default OtherPlayer;
