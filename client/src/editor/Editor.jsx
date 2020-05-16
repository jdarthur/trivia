import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList.jsx";
import RoundList from "../round/RoundList.jsx"

class Editor extends React.Component {
  render() {
    return (
      <div className="editor">
        <RoundList />
      	<QuestionList />
      </div>
    );
  }
}

export default Editor;