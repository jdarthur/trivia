import React from 'react';
import './Question.css';

class Question extends React.Component {
  render() {
    return (
      <div className="question_container"> 
  		<div className="category">
            {this.props.category}
        </div>
  		<div className="question">
  			{this.props.question}
        </div>
        <div className="answer">
        	{this.props.answer}
        </div>
  	</div>
    );
  }
}

export default Question;