import React from 'react';
import './ActiveGame.css';

import { Card, Breadcrumb } from 'antd';
import { PlaySquareOutlined } from '@ant-design/icons';
import ReactMarkdown from "react-markdown";

class ActiveQuestion extends React.Component {

  render() {
    // const question_newlined = this.props.question?.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

    return (

      <Card style={{ width: 400, marginTop: 10}} bodyStyle={{padding: 20}}  >
        <Breadcrumb style={{paddingBottom: 10}}>
          <Breadcrumb.Item>
            <PlaySquareOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.round_name} </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.category} </Breadcrumb.Item>
        </Breadcrumb>

        <div className="active-question-box">
          <ReactMarkdown className="active-question" source={this.props.question} />
          {this.props.answer ? <ReactMarkdown className="active-answer" source={this.props.answer} />: null}
        </div>
      </Card>
    );
  }
}

export default ActiveQuestion;