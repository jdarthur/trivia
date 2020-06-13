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
    this.props.set_selected("")
  }

  handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.altKey) {
      event.preventDefault()
      this.save_self()
    }
  }



  render() {
    if (this.props.selected) {
      const containerClass = "question_container selected"
      return (
        <div className={containerClass} onClick={this.set_selected} onKeyDown={this.handleKeyPress}>
          <input type='textarea' className="category" value={this.props.category}
            onChange={this.set_category} placeholder="Category" autoFocus />
          <textarea className="text-area" value={this.props.question}
            onChange={this.set_question} placeholder="Question" />
          <textarea className="text-area" value={this.props.answer}
            onChange={this.set_answer} placeholder="answer" />
          <div className="button-container">
            <button onClick={this.delete_self} className="delete-button button"> Delete </button>
            <button onClick={this.save_self} className="button"> Save </button>
          </div>

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



export default Question
