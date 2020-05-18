import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList.jsx";
import RoundList from "../round/RoundList.jsx"

class Editor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            round_selected: "",
            game_selected: "",
        }
    }

    a_round_is_selected = () => {
        return this.state.round_selected !== ""
    }

    add_question_to_open_round = (question_id) => {
        console.log("add to open round")
    }

    render() {
        return (
            <div className="editor">
                <RoundList />
                <QuestionList round_open={this.a_round_is_selected()}
                    add_to_round={this.add_question_to_open_round} />
            </div>
        );
    }
}

export default Editor;