import React from 'react';
import ReadOnlyQuestion from "./ReadOnlyQuestion"
import EditQuestionModal from "./EditQuestionModal"

class Question extends React.Component {

  select_self = (event) => {
    this.props.select(this.props.id)
  }

  delete_self = (event) => {
    this.props.delete(this.props.id)
  }

  render() {
    if (this.props.selected) {
      return (
        <EditQuestionModal answer={this.props.answer} question={this.props.question}
         category={this.props.category} select={this.props.select} set={this.props.set}
         id={this.props.id} delete={this.props.delete} />
      );
    }
    else {
      return (
        <ReadOnlyQuestion id={this.props.id} question={this.props.question}
          answer={this.props.answer} category={this.props.category}
          select={this.select_self} selected={this.props.selected}
          delete={this.delete_self} />
      );
    }
  }
}

export default Question
