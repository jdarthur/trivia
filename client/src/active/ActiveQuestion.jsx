import React from 'react';
import './ActiveGame.css';

import { Card } from 'antd';

class ActiveQuestion extends React.Component {

  render() {
    const question_newlined = this.props.question.split("^").map((part) => <div className="linebreak"> {part} </div>)

    return (

      <Card style={{ width: 400, 'margin-top': 10}} >
        <div className="active-question-box">
          <div className="active-question"> {question_newlined} </div>
          <div className="active-answer"> {this.props.answer} </div>
        </div>
      </Card>
    );
  }
}

export default ActiveQuestion;