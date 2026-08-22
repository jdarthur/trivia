import React from 'react';
import './Toolbar.css';

const PLAY = "play"
const EDITOR = "editor"

interface Props {
    select: (value: string) => void
    selected: string
}

class Toolbar extends React.Component<Props> {

  gameplay = () => {
    console.log(PLAY)
    this.props.select(PLAY)
  }

  editor = () => {
    console.log(EDITOR)
    this.props.select(EDITOR)
  }

  render() {
    return (
      <div className="toolbar">
        <div className={"toolbar-button" + (this.props.selected === PLAY ? " selected-tab" : "")} onClick={this.gameplay}>
          Play
        </div>
        <div className="toolbar-button" onClick={this.editor}>
          Editor
        </div>
      </div>
    );
  }

}

export default Toolbar;
