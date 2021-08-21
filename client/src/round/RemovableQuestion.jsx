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

        fetch(url, {headers:{"borttrivia-token": this.props.token}})
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
        console.log("select " + this.props.id)
        this.props.select(this.props.id)
    }

    render() {
        return (
            <div onClick={this.select_self} className="actionable-question">
                <ReadOnlyQuestion id={this.props.id} question={this.state.question}
                    answer={this.state.answer} category={this.state.category}
                    selected={this.props.selected} hide_extra={true}  />
            </div>
        );

    }
}

export default RemovableQuestion