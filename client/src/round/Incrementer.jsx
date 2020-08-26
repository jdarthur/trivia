import React from 'react';
import "./Wager.css"

class Incrementer extends React.Component {

    decr = () => {
        if (!(this.props.value === 0 && this.props.prevent_negative)) {
            this.props.set(this.props.index, this.props.value - 1, false)
        }
    }

    incr = () => {
        this.props.set(this.props.index, this.props.value + 1, false)
    }

    render() {
        const decr_class = "plus-or-minus decr" + (this.props.disabled || (this.props.value === 0 && this.props.prevent_negative) ? " disabled_action" : "")
        const incr_class = "plus-or-minus incr" + (this.props.disabled ? " disabled_action" : "")
        return (
            <div className="wager">
                <div className={decr_class} onClick={this.decr}> - </div>
                <div className="wager-text">{this.props.value}</div>
            <div className={incr_class} onClick={this.incr}> + </div>
            </div>
        );
    }
}

export default Incrementer