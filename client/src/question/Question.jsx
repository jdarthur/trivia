import React from 'react';
import './Question.css';

class Question extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selected: false
    }
  }

  set_selected = (event) => {
    this.setState({selected: true})
  }


  render() {
    const containerClass = "question_container" + (this.state.selected ? " selected" : "")
    console.log(containerClass)
    return (
      <div className={containerClass}
           onClick={this.set_selected}> 
  		<div className="category">
            {this.props.category}
        </div>
  		<div className="question">
  			{this.props.question}
        </div>
        <div className="answer">
        	{this.props.answer}
        </div>
  	</div>
    );
  }
}

export default Question;