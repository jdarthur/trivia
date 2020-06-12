import React from 'react';
import './Game.css';

class Game extends React.Component {
  set_selected = () => {
    this.props.set_selected(this.props.id)
  }

  render() {
    const r_count = this.props.rounds.length
    const r_label = r_count + " Round" + (r_count !== 1 ? "s" : "")
    const css_class = "game" + (this.props.selected ? " selected" : "")
    return (
      <div className={css_class} onClick={this.set_selected} >
        <div> {this.props.name === '' ? "unnamed game" : this.props.name} </div>
        <div> {r_label} </div>
      </div>
    );
  }
}

export default Game;