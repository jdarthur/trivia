import React from 'react';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

interface Props {
    id: string
    select: (id: string) => void
    selected: boolean
    token: string
}

interface State {
    question: string
    category: string
    answer: string
    question_type: string
    choices: { text: string, is_correct: boolean }[]
    pairs: { left: string, right: string }[]
    buckets: { text: string }[]
    items: { text: string, bucket: string }[]
}

class RemovableQuestion extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            question: "",
            category: "",
            answer: "",
            question_type: "",
            choices: [],
            pairs: [],
            buckets: [],
            items: [],
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
                        answer: state.answer,
                        question_type: state.question_type || "",
                        choices: state.choices || [],
                        pairs: state.pairs || [],
                        buckets: state.buckets || [],
                        items: state.items || [],
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
                    selected={this.props.selected} hide_extra={true}
                    question_type={this.state.question_type}
                    choices={this.state.choices} pairs={this.state.pairs}
                    buckets={this.state.buckets} items={this.state.items} />
            </div>
        );

    }
}

export default RemovableQuestion
