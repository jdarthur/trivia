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

    remove_selected = () => {
        this.props.remove_questions(this.state.selected_questions)
    }


    render() {
        const questions = this.props.questions.map((question_id) => (
            <RemovableQuestion key={question_id} id={question_id} select={this.select_item}
                selected={this.state.selected_questions.indexOf(question_id) !== -1}
            />)
        )

        return (
            <div>
                Removable Questions:
                <div className="question-list">
                    {questions}
                    <button onClick={this.remove_selected}> Remove Questions</button>
                </div>
            </div>
        );
    }
}

export default RemovableQuestionsList;