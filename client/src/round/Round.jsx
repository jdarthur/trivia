import React from 'react';
import './Round.css';

class Round extends React.Component {

  render() {
    const q_count = this.props.questions.length
    const q_label = q_count + " Question" + (q_count !== 1 ? "s" : "")
    return (
      <div className="round">
      	<div> {this.props.name} </div>
        <div> {q_label} </div>
      </div>
    );
  }
}

export default Round;