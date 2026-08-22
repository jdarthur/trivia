import React from 'react';
import './Game.css';

import {
  EditOutlined,
} from '@ant-design/icons';

import { Card } from 'antd';

interface Props {
  id: string
  name: string
  create_date?: string
  rounds: string[]
  round_names?: Record<string, string>
  selected: boolean
  set_selected: (id: string) => void
  delete?: (id: string) => void
}

class Game extends React.Component<Props> {
  set_selected = () => {
    this.props.set_selected(this.props.id)
  }

  render() {
    const r_count = this.props.rounds.length
    const r_label = r_count + " Round" + (r_count !== 1 ? "s" : "")

    const background = (this.props.selected ? "#f5f5f5" : "")
    const border = (this.props.selected ? "3px solid darkgray" : "")
    const title = this.props.name === '' ? "[unnamed game]" : this.props.name

    return (
      <Card size="small" title={title}
        style={{ width: 200, margin: 5, background: background, border: border }}
        extra={<EditOutlined onClick={this.set_selected} />} >
        <div> {r_label} </div>
      </Card>
    );
  }
}

export default Game;
