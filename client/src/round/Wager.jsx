import React from 'react';
import "./Wager.css"

class Wager extends React.Component {
    render() {
        return (
            <div className="wager">
                <div>{this.props.wager}</div>
            </div>
        );
    }
}

export default Wager