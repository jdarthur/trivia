import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList.jsx";
import RoundList from "../round/RoundList.jsx"
import GenericToolbar from "./GenericToolbar"

const QUESTIONS = "Questions"
const ROUNDS = "Rounds"
const GAMES = "Games"


class Editor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            section: QUESTIONS
        }
    }

    select_tab = (tab_name) => {
        console.log(tab_name)
        this.setState({ section: tab_name })
    }

    add_question_to_open_round = (question_id) => {
        //get open_round as obj
        //append question_id to open_round.questions
        //send data to server
        //if 200: 
        //update round.questions
        //setState
        //update state
        console.log("add to open round (" + this.state.round_selected + "): " + question_id)
    }

    render() {
        return (
            <div className="App">
                <GenericToolbar labels={[QUESTIONS, ROUNDS, GAMES]}
                 select={this.select_tab} selected={this.state.section} />

                <div className="editor">
                    {this.state.section === ROUNDS ? <RoundList /> : null }
                    {this.state.section === QUESTIONS ? <QuestionList /> : null } 
                </div>
            </div>
        );
    }
}

export default Editor;