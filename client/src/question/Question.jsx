import React from 'react';
import './Question.css';

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

class Question extends React.Component {

  set_selected = (event) => {
    this.props.set_selected(this.props.id)
  }

  set_category = (event) => {
    this.props.set(this.props.id, CATEGORY, event.target.value)
  }

  set_question = (event) => {
    this.props.set(this.props.id, QUESTION, event.target.value)
  }

  set_answer = (event) => {
    this.props.set(this.props.id, ANSWER, event.target.value)
  }

  render() {
    if (this.props.selected) {
      const containerClass = "question_container selected"
      return (
        <div className={containerClass} onClick={this.set_selected}>
          <input className="category" value={this.props.category}
            onChange={this.set_category} />
          <input className="question" value={this.props.question}
            onChange={this.set_question}/>
          <input className="answer"   value={this.props.answer}
            onChange={this.set_answer}/>
        </div>
      );
    }
    else {
      const containerClass = "question_container"
      return (
        <div className={containerClass} onClick={this.set_selected}>
          <div className="category"> {this.props.category} </div>
          <div className="question"> {this.props.question} </div>
          <div className="answer">   {this.props.answer}   </div>
        </div>
      );
    }
  }
}

export default Question;
