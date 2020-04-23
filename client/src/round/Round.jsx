import React from 'react';
import './Round.css';
import QuestionList from "../question/QuestionList.jsx";

class Round extends React.Component {
  render() {
    return (
      <div className="round">
      	<QuestionList />
      </div>
    );
  }
}

export default Round;