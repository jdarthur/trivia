import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList";
import RoundList from "../round/RoundList"
import GameList from "../game/GameList"

import { Breadcrumb } from 'antd';

const QUESTIONS = "Questions"
const ROUNDS = "Rounds"
const GAMES = "Games"


class Editor extends React.Component {
    render() {
        return (
            <div >
                <Breadcrumb style={{ margin: 16 }}>
                    <Breadcrumb.Item>Editor</Breadcrumb.Item>
                    <Breadcrumb.Item>{this.props.section}</Breadcrumb.Item>
                </Breadcrumb>

                <div className="editor">
                    {this.props.section === ROUNDS ? <RoundList token={this.props.token} /> : null}
                    {this.props.section === QUESTIONS ? <QuestionList token={this.props.token} /> : null}
                    {this.props.section === GAMES ? <GameList token={this.props.token} /> : null}
                </div>
            </div>
        );
    }
}

export default Editor;