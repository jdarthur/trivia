import React from 'react';
import './RoundList.css';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion.jsx"
import Wager from "./Wager.jsx"

const NAME = "name"
const QUESTIONS = "questions"
const WAGERS = "wagers"

class OpenRound extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value)
    }

    set_wager = (event) => {
        this.props.set(this.props.id, NAME, event.target.value)
    }

    delete = (question_id) => {
        this.props.delete(question_id)
    }

    render() {
        const questions = this.props.questions.map((question, index) => (
            <ReadOnlyQuestion key={question} id={question} delete={this.delete} />))

        const wagers = this.props.wagers.map((wager, index) => (
            <Wager key={index} id={index} wager={wager}/>))

        return (
            <div>
                <input className={NAME} value={this.props.name}
                    onChange={this.set_name} placeholder="Name" />
                <div className="question-list">
                    {questions}
                </div>
                <div className="wager-list">
                    {wagers}
                </div>
            </div>
        );
    }
}

export default OpenRound;