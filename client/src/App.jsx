import React from 'react';
import './App.css';
import GenericToolbar from "./editor/GenericToolbar.jsx"
import HomePage from "./homepage/Homepage.jsx"
import Editor from "./editor/Editor.jsx"

const PLAY = "Play"
const EDITOR = "Editor"

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selected: PLAY,
      show_toolbar: true
    }
  }

  componentDidMount() {
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let key = params.get("key");
    this.setState({key: key})
  }

  set_show_toolbar = (value) => {
    this.setState({ show_toolbar: value })
  }

  set_selected = (page) => {
    this.setState({ selected: page })
  }

  render() {
    return (
      <div className="App">
        { this.state.show_toolbar && this.state.key === "12344321" ? <GenericToolbar labels={[PLAY, EDITOR]}
          select={this.set_selected} selected={this.state.selected} /> : null }
        {this.state.selected === PLAY ? <HomePage set_toolbar={this.set_show_toolbar}/> : null}
        {this.state.selected === EDITOR ? <Editor /> : null}
      </div>
    );
  }

}

export default App;
