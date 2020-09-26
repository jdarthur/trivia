import React from 'react';
import '../question/Question.css';
import ReadOnlyQuestion from "../question/ReadOnlyQuestion"

class AddableQuestion extends React.Component {

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