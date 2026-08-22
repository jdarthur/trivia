import React from 'react';

import {ICONS} from "./Icons"

interface Props {
    icon_name?: string
}

class PlayerIcon extends React.Component<Props> {

  render() {
    return (
        ICONS[this.props.icon_name as string] || ICONS["question_circle"]
    )
  }
}

export default PlayerIcon;
