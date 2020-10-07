import React from 'react';
import './ActiveGame.css';

import { Card, Breadcrumb } from 'antd';
import { PlaySquareOutlined } from '@ant-design/icons';
import FormattedQuestion from "../question/FormattedQuestion"

class ActiveQuestion extends React.Component {

  render() {
    // const question_newlined = this.props.question?.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

    return (

      <Card style={{ width: 400, marginTop: 10 }} bodyStyle={{ padding: 20 }}  >
        <Breadcrumb style={{ paddingBottom: 10 }}>
          <Breadcrumb.Item>
            <PlaySquareOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.round_name} </Breadcrumb.Item>
          <Breadcrumb.Item> {this.props.category} </Breadcrumb.Item>
        </Breadcrumb>

        <div className="active-question-box">
          <FormattedQuestion question={this.props.question}
            answer={this.props.answer} max_width={350} />
        </div>
      </Card >
    );
  }
}

export default ActiveQuestion;