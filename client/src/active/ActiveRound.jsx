import React from 'react';
import './ActiveGame.css';
import CategoryInRound from "./CategoryInRound"


class ActiveRound extends React.Component {

  render() {
    const categories = this.props.categories.map((category, index) => (
      <CategoryInRound key={index} name={category}
        active={this.props.active_question === index} />
    ))

    return (
      <div className="round-and-question">
        <div className="active-round">
          {categories}
        </div>

      </div>

    );
  }
}

export default ActiveRound;