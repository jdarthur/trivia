import React from 'react';
import './Round.css';
/**
 * This is the round-icon that appears in the list.
 * Clicking ont one pulls it up in the open round
 * editor, where you can change round info, add &
 * remove questions, modify wagers, etc.
 */
class Round extends React.Component {
  set_selected = () => {
    this.props.set_selected(this.props.id)
  }

  render() {
    const q_count = this.props.questions.length
    const q_label = q_count + " Question" + (q_count !== 1 ? "s" : "")
    const css_class = "round" + (this.props.selected ? " selected" : "")
    return (
      <div className={css_class} onClick={this.set_selected} >
        <div> {this.props.name === '' ? "unnamed round" : this.props.name} </div>
        <div> {q_label} </div>
      </div>
    );
  }
}

export default Round;