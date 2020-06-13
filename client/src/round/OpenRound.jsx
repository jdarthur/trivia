import React from 'react';
import './OpenRound.css';
//import ReadOnlyQuestion from "../question/ReadOnlyQuestion.jsx"
// import AddableQuestionsList from "./AddableQuestionsList"
import AddQuestionsModal from "../modal/AddQuestionsModal"
import RemovableQuestionsList from "./RemovableQuestionsList"
import Wager from "./Wager.jsx"

const NAME = "name"
const QUESTIONS = "questions"

class OpenRound extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value)
    }

    // set_wager = (event) => {
    //     this.props.set(this.props.id, NAME, event.target.value)
    // }

    add_questions = (questions_list) => {
        this.props.set(this.props.id, QUESTIONS, this.props.questions.concat(questions_list))
        // this.save_self()
    }

    remove_questions = (questions_list) => {
        console.log(questions_list)
        for (let i = 0; i < questions_list.length; i++) {
            const index = this.props.questions.indexOf(questions_list[i])
            this.props.questions.splice(index, index + 1)
        }
        this.props.set(this.props.id, QUESTIONS, this.props.questions)

    }

    delete_self = () => {
        this.props.delete(this.props.id)
    }

    save_self = () => {
        this.props.set_selected("")
    }

    handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.altKey) {
            event.preventDefault()
            this.save_self()
        }
    }

    render() {
        // const questions = this.props.questions.map((question, index) => (
            // <ReadOnlyQuestion key={question} id={question} delete={this.delete} />))

        const wagers = this.props.wagers.map((wager, index) => (
            <Wager key={index} id={index} wager={wager} />))

        return (
            <div className="open-round">
                <input className={NAME} value={this.props.name}
                    onChange={this.set_name} onKeyDown={this.handleKeyPress} placeholder="Name" />
                <div>
                    {/* <AddableQuestionsList added_questions={this.props.questions} add_questions={this.add_questions} /> */}
                    <AddQuestionsModal questions={this.props.questions} add_questions={this.add_questions} />
                    <RemovableQuestionsList questions={this.props.questions} remove_questions={this.remove_questions} />
                </div>
                <div className="wager-list">
                    {wagers}
                </div>

                <div>
                    <button onClick={this.delete_self}> Delete </button>
                    <button onClick={this.save_self} > Save </button>
                </div>

            </div>


        );
    }
}

export default OpenRound;