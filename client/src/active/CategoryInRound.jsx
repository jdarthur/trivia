import React from 'react';
import './ActiveGame.css';

class CategoryInRound extends React.Component {
  render() {
    const rclass = "round-category" + (this.props.active ? " active" : "")
    return (
      <div className={rclass}>
          { this.props.name }
      </div>
    );
  }
}

export default CategoryInRound;