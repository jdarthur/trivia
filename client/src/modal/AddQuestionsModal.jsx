import React from 'react';
import './Modal.css';
import Modal from "./Modal"
// import AddableQuestionsList from "../round/AddableQuestionsList"
import AddableQuestion from "../round/AddableQuestion"



class AddQuestionsModal extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            selected_questions: [],
            is_open: false
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


    close_modal = () => {
        this.setState({ is_open: false, selected_questions: [], })
    }

    open_modal = () => {
        this.setState({ is_open: true }, () => {
            this.get_questions()
        })
    }

    select_item = (question_id, selected) => {
        const index = this.state.selected_questions.indexOf(question_id)
        if (index === -1) {
            this.state.selected_questions.push(question_id)
        }
        else {
            this.state.selected_questions.splice(index, index + 1)
        }
        this.setState({ selected_questions: this.state.selected_questions })
    }

    add_questions_and_close = () => {
        this.props.add_questions(this.state.selected_questions)
        this.close_modal()
    }

    render() {
        if (this.state.is_open === true) {

            const questions = []
            for (let i = 0; i < this.state.questions.length; i++) {
                const question = this.state.questions[i];
                if (this.props.questions.indexOf(question.id) === -1) {
                    questions.push(<AddableQuestion key={question.id} id={question.id}
                        question={question.question} answer={question.answer} category={question.category}
                        select={this.select_item} selected={this.state.selected_questions.indexOf(question.id) !== -1}
                        index={this.state.selected_questions.indexOf(question.id)}
                    />)
                }
            }
            return (
                <Modal is_open={this.state.is_open}
                    close={this.close_modal} transitionName="modal-anim"
                    title="Add Questions" save_label="Add" save={this.add_questions_and_close}>
                    <div className="body">
                        <div className="question-list">
                            {questions}
                        </div>
                    </div>
                </Modal>
            );
        }
        else {
            return (<button onClick={this.open_modal}>Add questions</button>)
        }
    }
}

export default AddQuestionsModal;