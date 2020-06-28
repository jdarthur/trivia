import React from 'react';
import "./AnswerQuestion.css"

class SelectableWager extends React.Component {

    select = () => {
        this.props.select(this.props.wager)
    }

    render() {
        const className = "selectable-wager" + (this.props.selected ? " sel-wager" : "")
        const remaining = "" + this.props.count + " remaining"
        return (
            <div className={className} onClick={this.select} title={remaining}> 
                {/* <div  className="wager-count"> x{this.props.count} </div> */}
                {this.props.wager}
            </div>
        );
    }
}

export default SelectableWager