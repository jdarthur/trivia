import React from 'react';
import './QuestionList.css';

import Question from "./Question.jsx"


//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"
const ID = "id"

class QuestionList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      questions: [],
      unused_only: true,
      text_filter: "",
      selected: "",
      dirty: "",
    }
  }

  componentDidMount() {
    this.get_questions()
  }

  get_questions = () =>  {
    let url = "/editor/questions?"
    if (this.state.text_filter !== "") {
      url += "text_filter=" + this.state.text_filter
    }

    if (this.state.unused_only === true) {
      url += "&unused_only=true"
    }


    fetch(url)
      .then(response => response.json())
      .then(state => {
        console.log("got questions")
        console.log(state)
        this.setState({questions: state.questions})
      })
  }

  set_unused_only = (event) => {
    const value = event.target.checked
    this.setState({unused_only: value}, () => { this.get_questions() })
  }

  set_text_filter = (event) => {
    const value = event.target.value
    this.setState({text_filter: value}, () => { this.get_questions() })
  }

  set_selected = (question_id) => {
    switch(this.state.selected) {
      case "":
      case question_id: break
      case "new":
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
            console.log("create question", question)
            sendData(null, "POST", question)
             .then((data) => {
               // console.log(data)
               question.id = data.id
               this.setState({questions: this.state.questions, dirty: ""})
             })
          }

          else { //update existing question
            console.log("save question", question)
            sendData(question_id, "PUT", question)
             .then((data) => {
               // console.log(data)
               this.setState({dirty: ""})
             })
          }
          return
        }
      }
      console.log("could not save data (question_id " + question_id + " not found)")
    }
  }

  delete = (question_id) => {
    for (const qindex in this.state.questions) {
      const question = this.state.questions[qindex]
      if (question.id === question_id) {

        if (question_id === "new") {
          delete this.state.questions[qindex]
          this.setState({questions: this.state.questions})
        }
        else {
          console.log("delete question", question)
          sendData(question_id, "DELETE")
           .then((data) => {
             delete this.state.questions[qindex]
             this.setState({questions: this.state.questions, dirty: ""})
          })
        }
        return
      }
    }
    console.log("could not delete (question_id " + question_id + " not found)")
  }

  add_newquestion_button = () => {
    for (const qindex in this.state.questions) {
        const question = this.state.questions[qindex]
        if (question.id === "new") {
          return false
        }
    }
    return true
  }

  add_new_question = () => {
    const question = {
      [QUESTION]: "",
      [ANSWER]: "",
      [CATEGORY]: "",
      [ID]: "new"
    }
    this.state.questions.push(question)
    this.setState({questions : this.state.questions}, () => {
      this.set_selected("new")
    })
  }


  render() {
    const questions = this.state.questions.map((question, index) => (

            <Question key={question.id} id={question.id} category={question.category}
                  answer={question.answer} question={question.question}
                  selected={(this.state.selected === question.id) ? true : false}
                  set_selected={this.set_selected} set={this.set_value} delete={this.delete} />))

    const nqb = this.add_newquestion_button() ? <div className="new_question_button" onClick={this.add_new_question}>+</div> : null
    return (
      <div className="ql_and_filter">
        Questions:
        <div className="filter_holder">

          <div className='filter'>
            <label htmlFor="text_filter"> Text filter: </label>
            <input name="text_filter" value={this.state.text_filter} onChange={this.set_text_filter} placeholder="Text filters"/>
          </div>

          <div className ="filter">
            <label htmlFor="unused_only"> Show unused questions only? </label>
            <input type="checkbox" name="unused_only" checked={this.state.unused_only} onChange={this.set_unused_only} />
          </div>
        </div>

        <div className="question_list">
        {questions}
        {nqb}
        </div>

      </div>
    );
  }
}

async function sendData(question_id, method, question_data) {
  const url = "/editor/question" + (question_id != null ? "/" + question_id : "")
  const body = (question_data === undefined) ? "" : JSON.stringify(question_data)
  const response = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: body
          })
  return response.json()
}

export default QuestionList;
