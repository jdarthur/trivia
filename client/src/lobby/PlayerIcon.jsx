import React from 'react';

import {ICONS} from "./Icons.js"

class PlayerIcon extends React.Component {

  render() {
    return (
        ICONS[this.props.icon_name] || ICONS["question_circle"]
    )
  }
}

export default PlayerIcon;