import React from 'react';
import './Modal.css';

import { Modal, Button } from 'antd';

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
        console.log(question_id)
        const index = this.state.selected_questions.indexOf(question_id)
        console.log(index)
        if (index === -1) {
            this.state.selected_questions.push(question_id)
        }
        else {
            this.state.selected_questions.splice(index, 1)
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

            const questions_sorted = this.state.questions.sort((a, b) => {
                const cat_a = a.category
                const cat_b = b.category
                return (cat_a < cat_b) ? -1 : 1
            })

            for (let i = 0; i < questions_sorted.length; i++) {
                const question = questions_sorted[i]
                if (this.props.questions.indexOf(question.id) === -1) {
                    questions.push(<AddableQuestion key={question.id} id={question.id}
                        question={question.question} answer={question.answer} category={question.category}
                        select={this.select_item} selected={this.state.selected_questions.indexOf(question.id) !== -1}
                        index={this.state.selected_questions.indexOf(question.id)}
                    />)
                }
            }
            return (

                <Modal
                    title="Add Questions"
                    visible={this.state.is_open}
                    onOk={this.add_questions_and_close}
                    okText="Add"
                    onCancel={this.close_modal}
                    width="50vw">

                    <div className="rem-question-list">
                        {questions}

                    </div>

                </Modal>
            );
        }
        else {
            return (

                <Button type="primary" onClick={this.open_modal} style={{'margin-bottom': '10px', 'margin-top': '10px'}}>
                    Add questions
                </Button>
            )
        }
    }
}

export default AddQuestionsModal;