import React from 'react';
import './OpenRound.css';
import AddableQuestion from "./AddableQuestion"

class AddableQuestionsList extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            selected_questions: []
        }
    }

    componentDidMount() {
        this.get_questions()
    }

    get_questions = () => {
        let url = "/editor/questions?unused_only=true"
        // if (this.state.text_filter !== "") {
        //   url += "text_filter=" + this.state.text_filter
        // }

        // if (this.state.unused_only === true) {
        //   url += "&unused_only=true"
        // }

        fetch(url)
            .then(response => response.json())
            .then(state => {
                console.log("got questions in addable questions")
                console.log(state)
                this.setState({ questions: state.questions })
            })
    }

    add_questions = () => {
        this.props.add_questions(this.state.selected_questions)
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
                    select={this.select_item} selected={this.state.selected_questions.indexOf(question.id) !== -1} />)
            }
        }

        return (
            <div>
                Addable Questions:
                <div className="question-list">
                    {questions}
                    <button onClick={this.add_questions}> Add questions </button>
                </div>
            </div>
        );
    }
}

export default AddableQuestionsList;