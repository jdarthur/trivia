import React from 'react';
import './ActiveGame.css';
import CategoryInRound from "./CategoryInRound"

import { Breadcrumb } from 'antd';
import { PlaySquareOutlined } from '@ant-design/icons';

class ActiveRound extends React.Component {

  render() {
    const categories = this.props.categories.map((category, index) => (
      <CategoryInRound key={index} name={category}
        active={this.props.active_question === index} />
    ))

    return (
      <div className="round-and-question">
        <Breadcrumb style={{'padding-bottom': '10px'}}>
          <Breadcrumb.Item>
            <PlaySquareOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.name} </Breadcrumb.Item>
        </Breadcrumb>
        <div className="active-round">
          {categories}
        </div>

      </div>

    );
  }
}

export default ActiveRound;