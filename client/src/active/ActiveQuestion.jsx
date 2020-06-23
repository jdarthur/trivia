import React from 'react';
import './ActiveGame.css';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

class ActiveQuestion extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      question: "",
      answer: "",
      category: ""
    }
  }

  componentDidMount() {
    this.get_current_question()
  }

  componentDidUpdate(prevProps) {
    if (this.props.session_state !== prevProps.session_state) {
      this.get_current_question()
    }
  }

  get_current_question = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/current-question"
    fetch(url)
      .then(response => response.json())
      .then(q => {
        console.log(q)

        this.setState({ question: q.question, answer: q.answer, category: q.category })
      })
  }

  render() {
    return (
      <div className="lobby">
        Question:
        <ReadOnlyQuestion question={this.state.question} answer={this.state.answer}
         category={this.state.category} />
      </div>
    );
  }
}

export default ActiveQuestion;