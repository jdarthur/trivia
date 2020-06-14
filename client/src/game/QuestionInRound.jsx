import React from 'react';
import ConciseReadOnlyQuestion from "../question/ConciseReadOnlyQuestion"

class QuestionInRound extends React.Component {

    constructor(props) {
        super(props)
        this.state = { question: "" }
    }

    componentDidMount() {
        this.get_question()
    }

    get_question = () => {
        let url = "/editor/question/" + this.props.id

        fetch(url)
            .then(response => response.json())
            .then(state => {
                this.setState({ question: state.question })
            })
    }
    
    render() {
        return (
            <ConciseReadOnlyQuestion question={this.state.question} />
        );
    }
}

export default QuestionInRound
