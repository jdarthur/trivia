import React from 'react';
import './ActiveGame.css';

class ActiveQuestion extends React.Component {

  render() {
    const question_newlined = this.props.question.split("^").map((part) => <div> {part} </div>)

    return (
      <div className="active-question">
        <div> {question_newlined}  </div>
        <div> {this.props.answer}   </div>
      </div>
    );
  }
}

export default ActiveQuestion;