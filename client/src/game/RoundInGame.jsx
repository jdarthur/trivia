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


    remove_self = () => {
        this.props.remove(this.props.id)
    }

    render() {
        const questions = this.state.questions.map((question_id) => (
            <QuestionInRound key={question_id} id={question_id} />))

        return (
            <div className="round-in-game">
                <div className="round-title"> {this.state.round_name}: </div>
                
                {questions}
            </div>
        );
    }
}

export default RoundInGame
