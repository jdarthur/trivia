import React from 'react';
import './OpenRound.css';
//import ReadOnlyQuestion from "../question/ReadOnlyQuestion.jsx"
// import AddableQuestionsList from "./AddableQuestionsList"
import AddQuestionsModal from "../modal/AddQuestionsModal"
import RemovableQuestionsList from "./RemovableQuestionsList"
import Wager from "./Wager.jsx"

const NAME = "name"
const QUESTIONS = "questions"
const WAGERS = "wagers"

class OpenRound extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value, false)
    }

    set_wager = (index, value) => {
        console.log("set wager " + index + "=" + value)
        this.props.wagers[index] = value
        this.props.set(this.props.id, WAGERS, this.props.wagers, false)
    }

    add_questions = (questions_list) => {
        const new_wagers = []
        for (let i = 0; i < questions_list.length; i++) {
            new_wagers.push(1)
        }
        const update = {
            [QUESTIONS]: this.props.questions.concat(questions_list),
            [WAGERS]: this.props.wagers.concat(new_wagers)
        }
        this.props.set_multi(this.props.id, update, true)
    }

    remove_questions = (questions_list) => {
        console.log(questions_list)
        for (let i = 0; i < questions_list.length; i++) {
            const index = this.props.questions.indexOf(questions_list[i])
            this.props.questions.splice(index, index + 1)
            this.props.wagers.splice(index, index + 1)
        }

        const update = {
            [QUESTIONS]: this.props.questions,
            [WAGERS]: this.props.wagers
        }
        this.props.set_multi(this.props.id, update, true)

    }

    delete_self = () => {
        this.props.delete(this.props.id)
    }

    save_self_and_close = () => {
        this.props.set_selected("")
    }

    save_self = () => {
        this.props.save(this.props.id)
    }

    handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.altKey) {
            event.preventDefault()
            this.save_self_and_close()
        }
    }

    render() {
        const wagers = this.props.wagers.map((wager, index) => (
            <Wager key={index} index={index} value={wager} set={this.set_wager}/>))

        return (
            <div className="open-round">
                <input className={NAME} value={this.props.name}
                    onChange={this.set_name} onKeyDown={this.handleKeyPress} placeholder="Name" />

                <div>
                    <AddQuestionsModal questions={this.props.questions}
                        save={this.save_self} add_questions={this.add_questions} />
                    <RemovableQuestionsList questions={this.props.questions} remove_questions={this.remove_questions} />
                </div>

                <div className="wager-list"> Wagers: {wagers} </div>

                <div>
                    <button onClick={this.delete_self} className="delete-button"> Delete Round </button>
                    <button onClick={this.save_self_and_close} > Save Round </button>
                </div>

            </div>


        );
    }
}

export default OpenRound;