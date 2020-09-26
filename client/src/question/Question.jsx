import React from 'react';
import './Question.css';
import ReadOnlyQuestion from "./ReadOnlyQuestion"

import { Card, Input, Button } from 'antd';

const { TextArea } = Input;

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

class Question extends React.Component {

  select_self = (event) => {
    this.props.select(this.props.id)
  }

  set_category = (event) => { this.set_value(event, CATEGORY) }
  set_question = (event) => { this.set_value(event, QUESTION) }
  set_answer = (event) => { this.set_value(event, ANSWER) }

  set_value = (event, key) => { this.props.set(this.props.id, key, event.target.value) }

  delete_self = (event) => {
    this.props.delete(this.props.id)
  }

  save_self = () => {
    this.props.select("")
  }

  handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      if (event.altKey) {
        console.log("alt-enter")
      }
      else {
        event.preventDefault()
        this.save_self()
      }
    }
  }



  render() {
    if (this.props.selected) {
      return (
        <Card size="small" style={{ width: 200, margin: 5, background: "#d9d9d9"}} >
          <Input placeholder="Category" value={this.props.category}
            onChange={this.set_category} onPressEnter={this.handleKeyPress} />
          <TextArea placeholder="Question" value={this.props.question}
            onChange={this.set_question} autoSize={{ minRows: 3 }} onPressEnter={this.handleKeyPress} />
          <Input placeholder="Answer" value={this.props.answer}
            onChange={this.set_answer} onPressEnter={this.handleKeyPress} />

          <div className="save-delete">
            <Button danger className="button" onClick={this.delete_self}> Delete</Button>
            <Button className="button" onClick={this.save_self}> Save</Button>
          </div>
        </Card>
      );
    }
    else {
      return (
        <ReadOnlyQuestion id={this.props.id} question={this.props.question}
          answer={this.props.answer} category={this.props.category}
          select={this.select_self} selected={this.props.selected}
          delete={this.delete_self} />
      );
    }
  }
}

export default Question
