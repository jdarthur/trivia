import React from 'react';
import './OpenRound.css';
import RemovableQuestion from "./RemovableQuestion"

class RemovableQuestionsList extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            selected_questions: []
        }
    }

    select_item = (question_id) => {
        const index = this.state.selected_questions.indexOf(question_id)
        if (index === -1) {
            this.state.selected_questions.push(question_id)
        }
        else {
            this.state.selected_questions.splice(index, index + 1)
        }
        this.setState({ selected_questions: this.state.selected_questions })
    }

    remove_selected = () => {
        if (this.state.selected_questions.length > 0) {
            this.props.remove_questions(this.state.selected_questions)
            this.setState({ selected_questions: [] })
        }

    }


    render() {
        const questions = this.props.questions.map((question_id) => (
            <RemovableQuestion key={question_id} id={question_id} select={this.select_item}
                selected={this.state.selected_questions.indexOf(question_id) !== -1}
            />)
        )

        return (
            <div className="question-list">
                {questions}
                <button onClick={this.remove_selected}> Remove Questions</button>
            </div>
        );
    }
}

export default RemovableQuestionsList;