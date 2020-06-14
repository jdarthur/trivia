import React from 'react';
import "./Wager.css"

class Wager extends React.Component {

    decr = () => {
        if (this.props.value > 0) {
            this.props.set(this.props.index, this.props.value - 1, false)
        }
    }

    incr = () => {
        this.props.set(this.props.index, this.props.value + 1, false)
    }

    render() {
        return (
            <div className="wager">
                <div className="plus-or-minus" onClick={this.decr}> - </div>
                <div className="wager-text">{this.props.value}</div>
            <div className="plus-or-minus" onClick={this.incr}> + </div>
            </div>
        );
    }
}

export default Wager