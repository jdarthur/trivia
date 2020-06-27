import React from 'react';
import "./AnswerQuestion.css"

class SelectableWager extends React.Component {

    select = () => {
        this.props.select(this.props.wager)
    }

    render() {
        const className = "selectable-wager" + (this.props.selected ? " sel-wager" : "")
        return (
            <div className={className} onClick={this.select}> {this.props.wager}</div>
        );
    }
}

export default SelectableWager