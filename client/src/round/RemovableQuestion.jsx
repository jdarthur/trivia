import React from 'react';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

class RemovableQuestion extends React.Component {
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

    select_self = () => {
        this.props.select(this.props.id)
    }

    render() {
        return (
            <div>
                <ReadOnlyQuestion id={this.props.id} question={this.state.question}
                    answer={this.state.answer} category={this.state.category}
                    select={this.props.select} selected = {this.props.selected} />
            </div>
        );

    }
}

export default RemovableQuestion