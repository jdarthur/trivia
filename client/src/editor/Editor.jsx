import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList";
import RoundList from "../round/RoundList"
import GameList from "../game/GameList"
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

    render() {
        return (
            <div className="flex-grow">
                <GenericToolbar labels={[QUESTIONS, ROUNDS, GAMES]}
                 select={this.select_tab} selected={this.state.section} />

                <div className="editor">
                    {this.state.section === ROUNDS ? <RoundList /> : null }
                    {this.state.section === QUESTIONS ? <QuestionList /> : null }
                    {this.state.section === GAMES ? <GameList /> : null }
                </div>
            </div>
        );
    }
}

export default Editor;