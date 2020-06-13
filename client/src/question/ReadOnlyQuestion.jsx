import React from 'react';
import './Question.css';

class ReadOnlyQuestion extends React.Component {

    select_self = () => {
        this.props.select(this.props.id)
    }

    render() {
        const containerClass = "question_container" + (this.props.selected ? " selected" : "")
        return (
            <div className={containerClass} onClick={this.select_self}>
                <div className="category"> {this.props.category} </div>
                <div className="question"> {this.props.question} </div>
                <div className="answer">  {this.props.answer}   </div>
            </div>
        );
    }
}

export default ReadOnlyQuestion
