import React from 'react';
import './Game.css';

import {
  EditOutlined,
} from '@ant-design/icons';

import { Card } from 'antd';

class Game extends React.Component {
  set_selected = () => {
    this.props.set_selected(this.props.id, !this.props.selected)
  }

  render() {
    const r_count = this.props.rounds.length
    const r_label = r_count + " Round" + (r_count !== 1 ? "s" : "")

    const background = (this.props.selected ? "#d9d9d9" : "")
    const title = this.props.name === '' ? "[unnamed game]" : this.props.name

    return (
      <Card size="small" title={title} style={{ width: 200, margin: 5, background: background }}
        extra={<EditOutlined onClick={this.set_selected} />} >
        <div> {r_label} </div>
      </Card>
    );
  }
}

export default Game;