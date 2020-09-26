import React from 'react';
import './Homepage.css';
import { Card } from 'antd';

class GameName extends React.Component {

  select_self = () => {
    this.props.select(this.props.id)
  }

  render() {
    const background = this.props.selected ? "#d9d9d9" : ""
    const date = new Date(this.props.create_date);

    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = date.toLocaleDateString(undefined, options);

    return (
      <div onClick={this.select_self}>
        <Card title={this.props.name} size="small"
          style={{ width: 200, margin: 5, background: background, cursor: "pointer" }}>
          <p>{this.props.round_count + " round" + (this.props.round_count !== 1 ? "s" : "")} </p>
          <p >{dateString}</p>
        </Card>
      </div>

    )
  }
}

export default GameName;