import React from 'react';
import './QuestionList.css';

import DeleteConfirm from "../editor/DeleteConfirm"
import EditorFilter from "../editor/EditorFilter.jsx"
import LoadingOrView from "../editor/LoadingOrView"

import { Table } from "antd"

import {
  PlusSquareOutlined,
  EditOutlined
} from '@ant-design/icons';
import EditQuestionModal from './EditQuestionModal';


//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"
const ID = "id"
const NEW = "new"

class QuestionList extends React.Component {

  state = {
    questions: [],
    unused_only: true,
    text_filter: "",
    selected: "",
    dirty: "",
    loading: false
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
    const data = this.state.questions.filter(item => item.id !== question.id);//   this.state.questions.splice(index, 1)
    this.setState({ questions: data, dirty: "", selected: "" })
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
    const data = [...this.state.questions]
    data.push(question)
    this.setState({ questions: data }, () => {
      this.set_selected(NEW)
    })
  }

  render() {

    const delete_edit = (text, record) => <span style={{ fontSize: '1.2em' }}>
      <DeleteConfirm delete={() => this.delete(record.id)} style={{ paddingRight: 10 }} />
      <EditOutlined onClick={() => this.set_selected(record.id)} />
    </span>

    const columns = [
      { title: "", render: delete_edit, width: '7em' },
      { title: 'Category', dataIndex: 'category', ellipsis: { showTitle: false } },
      { title: 'Question', dataIndex: 'question', ellipsis: { showTitle: false }, width: '50%' },
      { title: 'Answer', dataIndex: 'answer', ellipsis: { showTitle: false } }
    ]


    let question_editor = null;
    if (this.state.selected) {
      const selected = find(this.state.selected, this.state.questions)
      question_editor = <EditQuestionModal answer={selected.answer} question={selected.question}
        category={selected.category} select={this.set_selected} set={this.set_value}
        id={this.state.selected} delete={this.delete} />
    }


    const nqb = this.add_newquestion_button() ? <PlusSquareOutlined className="new_button" onClick={this.add_new_question} /> : null
    const pagination = {
      total: this.state.questions.length,
      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
    }

    const table_and_modal = <div>
      {question_editor}
      <Table columns={columns} dataSource={this.state.questions} pagination={pagination} />
    </div>

    return (
      <div className="ql_and_filter">
        <EditorFilter set_text_filter={this.set_text_filter} set_unused_only={this.set_unused_only} data_type="questions"
          text_filter={this.state.text_filter} unused_only={this.state.unused_only} add_button={nqb} />
        <LoadingOrView loading={this.state.loading} class_name="question-list"
          empty={this.state.questions?.length === 0} loaded_view={table_and_modal} />
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
