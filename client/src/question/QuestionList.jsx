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
      selected: ""
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
    this.setState({selected: question_id});
  }

  set_value = (question_id, key, value) => {
    let q = null
    for (const qindex in this.state.questions) {
      const question = this.state.questions[qindex]
      console.log(question)
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
      this.setState({questions: this.state.questions});
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

export default QuestionList;
