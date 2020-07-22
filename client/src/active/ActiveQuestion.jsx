import React from 'react';
import './ActiveGame.css';

class ActiveQuestion extends React.Component {

  render() {
    const question_newlined = this.props.question.split("^").map((part) => <div> {part} </div>)

    return (
      <div className="active-question-box">
        <div className="active-question"> {question_newlined}  </div>
        <div className="active-answer"> {this.props.answer} </div>
      </div>
    );
  }
}

export default ActiveQuestion;