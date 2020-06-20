import React from 'react';
import './Homepage.css';

class GameName extends React.Component {

  select_self = () => {
    this.props.select(this.props.id)
  }

  render() {
    const className = "game-name" + (this.props.selected ? " selected" : "")
    return (
      <div className={className} onClick={this.select_self}>
        {this.props.name}
      </div>
    )
  }
}

export default GameName;