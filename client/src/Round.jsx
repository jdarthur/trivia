import React from 'react';
import './Round.css';
import Question from "./Question.jsx";

class Round extends React.Component {
  render() {
    return (
      <div className="round">
        <Question category="Geography" answer="Montpelier"
                  question="What is the capital of Vermont?"/>
      </div>
    );
  }
}

export default Round;