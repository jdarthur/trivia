import React from 'react';
import '../round/OpenRound.css';
import RoundInGame from "./RoundInGame"

const NAME = "name"
// const QUESTIONS = "questions"

class OpenGame extends React.Component {

    set_name = (event) => {
        this.props.set(this.props.id, NAME, event.target.value)
    }

    // add_questions = (questions_list) => {
    //     this.props.set(this.props.id, QUESTIONS, this.props.questions.concat(questions_list))
    // }

    // remove_questions = (questions_list) => {
    //     console.log(questions_list)
    //     for (let i = 0; i < questions_list.length; i++) {
    //         const index = this.props.questions.indexOf(questions_list[i])
    //         this.props.questions.splice(index, index + 1)
    //     }
    //     this.props.set(this.props.id, QUESTIONS, this.props.questions)

    // }

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
        const rounds = this.props.rounds.map((round_id) => (
            <RoundInGame key={round_id} id={round_id} />))

        return (
            <div className="open-round">
                <input className={NAME} value={this.props.name}
                    onChange={this.set_name} onKeyDown={this.handleKeyPress} placeholder="Name" />
                <div>
                    Rounds:
                    {rounds}
                </div>

                <div>
                    <button onClick={this.delete_self}> Delete </button>
                    <button onClick={this.save_self} > Save </button>
                </div>

            </div>


        );
    }
}

export default OpenGame;