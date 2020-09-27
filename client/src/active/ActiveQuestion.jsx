import React from 'react';
import './ActiveGame.css';

import { Card, Input, Button } from 'antd';

class ActiveQuestion extends React.Component {

  render() {
    const question_newlined = this.props.question.split("^").map((part) => <div className="linebreak"> {part} </div>)

    return (

      <Card style={{ width: 500, margin: 10 }} >
        <div className="active-question-box">
          <div className="active-question"> {question_newlined} </div>
          <div className="active-answer"> {this.props.answer} </div>
        </div>
      </Card>


      // <div className="active-question-box">
      //   <div className="active-question"> {question_newlined}  </div>
      //   <div className="active-answer"> {this.props.answer} </div>
      // </div>
    );
  }
}

export default ActiveQuestion;