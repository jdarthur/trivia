import React from 'react';
import './Round.css';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

interface Props {
    id: string
    question: string
    answer: string
    category: string
    selected: boolean
    hide_extra: boolean
    index: number
    select: (id: string) => void
}

class AddableQuestion extends React.Component<Props> {

    select_self = () => {
        this.props.select(this.props.id)
    }

    render() {
        return (
            <div onClick={this.select_self}>
            <ReadOnlyQuestion id={this.props.id} question={this.props.question}
                    answer={this.props.answer} category={this.props.category}
                    selected={this.props.selected} hide_extra={true}/>
            {this.props.index !== -1 ? this.props.index + 1 : null}
            </div>
        );

    }
}

export default AddableQuestion
