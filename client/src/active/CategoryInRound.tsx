import React from 'react';
import './ActiveGame.css';

interface Props {
    name: string
    active: boolean
}

class CategoryInRound extends React.Component<Props> {
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
