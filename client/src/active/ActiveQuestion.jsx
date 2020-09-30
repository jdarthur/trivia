import React from 'react';
import './ActiveGame.css';

import { Card, Breadcrumb } from 'antd';
import { PlaySquareOutlined } from '@ant-design/icons';

class ActiveQuestion extends React.Component {

  render() {
    const question_newlined = this.props.question.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

    return (

      <Card style={{ width: 400, marginTop: 10}} bodyStyle={{padding: 15}}  >
        <Breadcrumb style={{paddingBottom: 10}}>
          <Breadcrumb.Item>
            <PlaySquareOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.round_name} </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.category} </Breadcrumb.Item>
        </Breadcrumb>

        <div className="active-question-box">
          <div className="active-question"> {question_newlined} </div>
          {this.props.answer ? <div className="active-answer"> {this.props.answer} </div> : null}
        </div>
      </Card>
    );
  }
}

export default ActiveQuestion;