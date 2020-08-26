import React from 'react';
import './Question.css';
import ReadOnlyQuestion from "./ReadOnlyQuestion"

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

class Question extends React.Component {

  select_self = (event) => {
    this.props.select(this.props.id)
  }

  set_category = (event) => {
    this.set_value(event, CATEGORY)
    //this.props.set(this.props.id, CATEGORY, event.target.value)
  }

  set_question = (event) => {
    this.set_value(event, QUESTION)
    //this.props.set(this.props.id, QUESTION, event.target.value)
  }

  set_answer = (event) => {
    this.set_value(event, ANSWER)
    //this.props.set(this.props.id, ANSWER, event.target.value)
  }

  set_value = (event, key) => {
    this.props.set(this.props.id, key, event.target.value)
  }

  delete_self = (event) => {
    this.props.delete(this.props.id)
  }

  save_self = () => {
    this.props.select("")
  }

  handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.altKey) {
      event.preventDefault()
      this.save_self()
    }
  }



  render() {
    if (this.props.selected) {
      const containerClass = "question_container selected editable_question"
      return (
        <div className={containerClass} onKeyDown={this.handleKeyPress}>
          <input value={this.props.category}
            onChange={this.set_category} placeholder="Category" autoFocus />
          <textarea className="question_input q_and_a" value={this.props.question}
            onChange={this.set_question} placeholder="Question" />
          <textarea className="answer_input q_and_a" value={this.props.answer}
            onChange={this.set_answer} placeholder="answer" />
          <div className="button-container">
            <button onClick={this.delete_self} className="delete-button button"> Delete </button>
            <button onClick={this.save_self} className="button"> Save </button>
          </div>

        </div>
      );
    }
    else {
      return (
        <ReadOnlyQuestion id={this.props.id} question={this.props.question}
                    answer={this.props.answer} category={this.props.category}
                    select={this.select_self} selected={this.props.selected} />
      );
    }
  }
}



export default Question
