import React from 'react';
import './ActiveGame.css';
import CategoryInRound from "./CategoryInRound"

class ActiveRound extends React.Component {

  render() {
    const categories = this.props.categories.map((category, index) => (
      <CategoryInRound key={index} name={category}
        active={this.props.active_category === category} />
    ))

    return (
      <div className="active-round">
        <div className="round-name"> {this.props.round_name} </div>
        {categories}
      </div>
    );
  }
}

export default ActiveRound;