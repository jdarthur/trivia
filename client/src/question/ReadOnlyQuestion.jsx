import React from 'react';
import './Question.css';

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

class ReadOnlyQuestion extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            question: "",
            category: "",
            answer: "",
        }
    }

    componentDidMount() {
        this.get_question()
    }

    get_question = () => {
        let url = "/editor/question/" + this.props.id

        fetch(url)
            .then(response => response.json())
            .then(state => {
                this.setState(
                    {
                        category: state.category,
                        question: state.question,
                        answer: state.answer
                    })
            })
    }

    render() {
        const containerClass = "question_container"
        return (
            <div className={containerClass}>
                <div className="category"> {this.state.category} </div>
                <div className="question"> {this.state.question} </div>
                <div className="answer">   {this.state.answer}   </div>
            </div>
        );

    }
}

export default ReadOnlyQuestion
