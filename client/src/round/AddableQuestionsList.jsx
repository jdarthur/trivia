import React from 'react';
import './OpenRound.css';
import AddableQuestion from "../round/AddableQuestion"

class AddableQuestionsList extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            selected_questions: []
        }
    }

    select_item = (question_id) => {
        const index = this.state.selected_questions.indexOf(question_id)
        if (index ===  -1) {
            this.state.selected_questions.push(question_id)
        }
        else {
            this.state.selected_questions.splice(index, index + 1)
        }
        this.setState({selected_questions: this.state.selected_questions})
    }


    render() {
        const questions = []
        for (let i = 0; i < this.state.questions.length; i++) {
            const question = this.state.questions[i];
            if (this.props.added_questions.indexOf(question.id) === -1) {
                questions.push(<AddableQuestion key={question.id} id={question.id}
                    question={question.question} answer={question.answer} category={question.category}
                    select={this.select_item} selected={this.state.selected_questions.indexOf(question.id) !== -1} 
                    index={this.state.selected_questions.indexOf(question.id)}
                    />)
            }
        }

        return (
            <div>
                <div className="question-list">
                    {questions}=
                </div>
            </div>
        );
    }
}

export default AddableQuestionsList;