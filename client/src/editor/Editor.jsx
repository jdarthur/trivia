import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList.jsx";

class Editor extends React.Component {
  render() {
    return (
      <div className="editor">
      	<QuestionList />
      </div>
    );
  }
}

export default Editor;