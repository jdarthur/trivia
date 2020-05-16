import React from 'react';
import './App.css';
import Toolbar from "./homepage/Toolbar.jsx"
import HomePage from "./homepage/Homepage.jsx"
import Editor from "./editor/Editor.jsx"

const PLAY = "play"
const EDITOR = "editor"

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selected: PLAY
    }
  }

  set_selected = (page) => {
    this.setState({selected : page})
  }

  render() {
    return (
      <div className="App">
        <Toolbar select={this.set_selected} selected={this.state.selected}/>
        {this.state.selected === PLAY ? <HomePage /> : null}
        {this.state.selected === EDITOR ? <Editor /> : null}
      </div>
    );
  }

}

export default App;
