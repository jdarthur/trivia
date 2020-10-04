import React from 'react';
import './QuestionList.css';

import Question from "./Question.jsx"
import EditorFilter from "../editor/EditorFilter.jsx"
import LoadingOrView from "../editor/LoadingOrView"

import {
  PlusSquareOutlined
} from '@ant-design/icons';


//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"
const ID = "id"
const NEW = "new"

class QuestionList extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      questions: [],
      unused_only: true,
      text_filter: "",
      selected: "",
      dirty: "",
      loading: false
    }
  }

  componentDidMount() {
    this.get_questions()
  }

  get_questions = () => {
    let url = "/editor/questions?"
    if (this.state.text_filter !== "") {
      url += "text_filter=" + this.state.text_filter
    }

    if (this.state.unused_only === true) {
      url += "&unused_only=true"
    }

    this.setState({ loading: true }, () => {
      fetch(url)
        .then(response => response.json())
        .then(state => {
          console.log(state)
          this.setState({ questions: state.questions, loading: false })
        })
    })
  }

  set_unused_only = (value) => {
    this.setState({ unused_only: value }, () => { this.get_questions() })
  }

  set_text_filter = (value) => {
    this.setState({ text_filter: value }, () => { this.get_questions() })
  }

  set_selected = (question_id) => {
    if (this.state.selected !== question_id) {
      this.save(this.state.selected)
      this.setState({ selected: question_id });
    }
  }

  select_none = (event) => {
    console.log(event)
    if (event.target.id === "background") {
      event.stopPropagation();
      this.set_selected("")
    }
  }

  set_value = (question_id, key, value) => {
    const question = find(question_id, this.state.questions)
    question[key] = value
    this.setState({ questions: this.state.questions, dirty: question_id });
  }

  save = (question_id) => {
    if (this.state.dirty !== "") {
      const question = find(question_id, this.state.questions)
      if (question_id === NEW) { //create new question
        delete question.id
        console.log("create question", question)
        sendData(null, "POST", question)
          .then((data) => {
            console.log(data)
            question.id = data.id
            this.setState({ questions: this.state.questions, dirty: "" })
          })
      }
      else {
        sendData(question_id, "PUT", question)
          .then((data) => { this.setState({ dirty: "" }) })
      }
    }
  }

  delete = (question_id) => {
    const question = find(question_id, this.state.questions)
    if (question_id === NEW) {
      this.delete_and_update_state(question)
    }
    else {
      console.log("delete question", question)
      sendData(question_id, "DELETE")
        .then((data) => { this.delete_and_update_state(question) })
    }
  }

  /**
  * delete a question by value & update the state of the rounds list
  */
  delete_and_update_state = (question) => {
    const index = this.state.questions.map(function (e) { return e.id; }).indexOf(question.id);
    this.state.questions.splice(index, 1)
    this.setState({ questions: this.state.questions, dirty: "", selected: "" })
  }

  add_newquestion_button = () => {
    try {
      find("new", this.state.questions)
      return false
    }
    catch (Error) { return this.state.loading === false }
  }

  add_new_question = () => {
    const question = {
      [QUESTION]: "",
      [ANSWER]: "",
      [CATEGORY]: "",
      [ID]: NEW
    }
    this.state.questions.unshift(question)
    this.setState({ questions: this.state.questions }, () => {
      this.set_selected(NEW)
    })
  }


  render() {
    const questions = this.state.questions.map((question, index) => (
      <Question key={question.id} id={question.id} category={question.category}
        answer={question.answer} question={question.question}
        selected={(this.state.selected === question.id) ? true : false}
        addable={this.props.round_open} add_to_round={this.props.add_to_round}
        select={this.set_selected} set={this.set_value}
        delete={this.delete} />))

    const nqb = this.add_newquestion_button() ? <PlusSquareOutlined className="new_button" onClick={this.add_new_question} /> : null

    return (
      <div className="ql_and_filter">
        <EditorFilter set_text_filter={this.set_text_filter} set_unused_only={this.set_unused_only} data_type="questions"
          text_filter={this.state.text_filter} unused_only={this.state.unused_only} add_button={nqb} />
        <LoadingOrView loading={this.state.loading} class_name="question-list"
          empty={questions?.length === 0} loaded_view={questions} />
      </div>
    );
  }
}

function find(object_id, object_list) {
  if (object_id === '') {
    return null
  }
  for (const index in object_list) {
    const object = object_list[index]
    if (object.id === object_id) {
      return object
    }
  }
  throw new Error("Could not find object with ID '" + object_id + "'!")
}

async function sendData(question_id, method, question_data) {
  const url = "/editor/question" + (question_id != null ? "/" + question_id : "")
  let body = ""
  if (question_data !== undefined) {
    const q_copy = Object.assign({}, question_data)
    delete q_copy.id
    delete q_copy.create_date
    delete q_copy.rounds_used
    body = JSON.stringify(q_copy)
  }

  JSON.stringify(question_data)
  const response = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: body
  })
  return response.json()
}

export default QuestionList;
