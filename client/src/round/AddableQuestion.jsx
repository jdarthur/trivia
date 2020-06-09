import React from 'react';
import '../question/Question.css';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

class AddableQuestion extends React.Component {

    select_self = () => {
        this.props.select(this.props.id)
    }

    render() {
        return (
            <ReadOnlyQuestion id={this.props.id} question={this.props.question}
                    answer={this.props.answer} category={this.props.category} 
                    select={this.select_self} selected={this.props.selected} />
        );

    }
}

export default AddableQuestion