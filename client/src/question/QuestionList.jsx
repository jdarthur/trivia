import React from 'react';
import './QuestionList.css';

import Question from "./Question.jsx"


// const questions = [
//   {
//     question: "q",
//     answer: "a",
//     category: "c",
//     id: 1234
//   }
// ]

class QuestionList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      questions: [],
      unused_only: true,
      text_filter: "",
      selected: "",
      dirty: ""
    }
  }

  componentDidMount() {
    fetch("/api/questions")
      .then(response => response.json())
      .then(state => this.setState({questions: state.questions}));
  }

  set_unused_only = (event) => {
    const value = event.target.checked
    this.setState({unused_only: value})
  }

  set_text_filter = (event) => {
    const value = event.target.value
    this.setState({text_filter: value})
  }

  set_selected = (question_id) => {
    switch(this.state.selected) {
      case "":
      case question_id: break
      case "new": break //create a new question
      default: this.save(this.state.selected)
    }

    this.setState({selected: question_id});
  }

  select_none = (event) => {
    console.log(event)
    if (event.target.id === "background") {
        event.stopPropagation();
        this.set_selected("")
    }
  }

  set_value = (question_id, key, value) => {
    let q = null
    for (const qindex in this.state.questions) {
      const question = this.state.questions[qindex]
      if (question.id === question_id) {
        q = question
        break
      }
    }

    if (q === null) {
      console.log("could not update data (question_id " + question_id + " not found)")
    }
    else {
      q[key] = value
      this.setState({questions: this.state.questions, dirty: question_id});
    }
  }

  save = (question_id) => {
    if (this.state.dirty !== "") {

      for (const qindex in this.state.questions) {
        const question = this.state.questions[qindex]

        if (question.id === question_id) {

          if (question_id === "new") { //create new question
            sendData(null, "POST", question)
             .then((data) => {
               console.log(data)
               this.setState({dirty: ""})
             })
          }

          else { //update existing question
            sendData(question_id, "PUT", question)
             .then((data) => {
               console.log(data)
               this.setState({dirty: ""})
             })
          }
          return
        }
      }
      console.log("could not save data (question_id " + question_id + " not found)")
    }
  }


  render() {
    const questions = this.state.questions.map((question, index) => (
            <Question key={question.id} id={question.id} category={question.category}
                  answer={question.answer} question={question.question}
                  selected={(this.state.selected === question.id) ? true : false}
                  set_selected={this.set_selected} set={this.set_value} />))

    return (
      <div>
        <input name="text_filter" value={this.state.text_filter} onChange={this.set_text_filter} placeholder="Text filters"/>
        <input type="checkbox" name="text_filter" checked={this.state.unused_only} onChange={this.set_unused_only} />
        <div className="question_list">
          {questions}
  		  </div>
  	  </div>
    );
  }
}

async function sendData(question_id, method, question_data) {
  const url = "/api/question" + (question_id != null ? "/" + question_id : "")
  const body = (question_data === undefined) ? "" : JSON.stringify(question_data)
  const response = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: body
          })
  return response.json()
}

export default QuestionList;
