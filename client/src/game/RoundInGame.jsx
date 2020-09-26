import React from 'react';
import "./OpenGame.css"
import QuestionInRound from "./QuestionInRound"

/**
 * This is a round inside of an open game. It shows
 * its questions and can be deleted from the game.
 */
class RoundInGame extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            round_name: ""
        }
    }

    componentDidMount() {
        this.get_round()
    }

    get_round = () => {
        let url = "/editor/round/" + this.props.id

        fetch(url)
            .then(response => response.json())
            .then(state => {
                console.log(state)
                this.setState({
                    questions: state.questions,
                    round_name: state.name
                })
            })
    }

    select_self = () => {
        this.props.select(this.props.id)
    }

    remove_self = () => {
        this.props.remove(this.props.id)
    }

    render() {
        const questions = this.state.questions.map((question_id) => (
            <QuestionInRound key={question_id} id={question_id} />))

        const containerClass = "round-and-index"
        const subContainerClass = (this.props.show_title ? "round-in-game" : "") + (this.props.selected ? " selected" : "")
        return (
            <div className={containerClass}>
                <div className={subContainerClass} onClick={this.select_self}>
                    {this.props.show_title ? <div className="round-title"> {this.state.round_name}: </div> : null}
                    {questions.length > 0 ? questions : (<div className="empty-round">no questions</div>)}
                </div>
                {this.props.index !== -1 && this.props.index !== undefined ? this.props.index + 1 : null}
            </div>

        );
    }
}

export default RoundInGame
