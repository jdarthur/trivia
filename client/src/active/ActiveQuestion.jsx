import React from 'react';
import './ActiveGame.css';

class ActiveQuestion extends React.Component {

  render() {
    return (
      <div className="active-question">
        <div> {this.props.question} </div>
        <div> {this.props.answer}   </div>
      </div>
    );
  }
}

export default ActiveQuestion;