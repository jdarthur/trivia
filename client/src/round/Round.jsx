import React from 'react';
import './Round.css';

import {
  EditOutlined,
} from '@ant-design/icons';

import { Card } from 'antd';

/**
 * This is the round-icon that appears in the list.
 * Clicking ont one pulls it up in the open round
 * editor, where you can change round info, add &
 * remove questions, modify wagers, etc.
 */
class Round extends React.Component {
  set_selected = () => {
    this.props.set_selected(this.props.id, !this.props.selected)
  }

  render() {
    const q_count = this.props.questions.length
    const q_label = q_count + " Question" + (q_count !== 1 ? "s" : "")

    const background = (this.props.selected ? "#d9d9d9" : "")
    const title = this.props.name === '' ? "[unnamed round]" : this.props.name

    return (
      <Card size="small" title={title} style={{ width: 200, margin: 5, background: background }}
        extra={<EditOutlined onClick={this.set_selected} />} >
        <div> {q_label} </div>
      </Card>
    );
  }
}

export default Round;