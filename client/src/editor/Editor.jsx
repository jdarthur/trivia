import React from 'react';
import './Editor.css';
import QuestionList from "../question/QuestionList";
import RoundList from "../round/RoundList"
import GameList from "../game/GameList"

import { Breadcrumb } from 'antd';
import CollectionList from "../collections/CollectionList";

const QUESTIONS = "Questions"
const ROUNDS = "Rounds"
const GAMES = "Games"
const COLLECTIONS = "Collections"


class Editor extends React.Component {
    render() {
        return (
            <div style={{overflowY: "auto"}}>
                <span>
                    <Breadcrumb style={{ marginLeft: 15, marginTop: 10, display: "flex" }}>
                        <Breadcrumb.Item>Editor</Breadcrumb.Item>
                        <Breadcrumb.Item>{this.props.section}</Breadcrumb.Item>
                    </Breadcrumb>
                </span>


                <div className="editor">
                    {this.props.section === ROUNDS ? <RoundList token={this.props.token} /> : null}
                    {this.props.section === QUESTIONS ? <QuestionList token={this.props.token} /> : null}
                    {this.props.section === GAMES ? <GameList token={this.props.token} /> : null}
                    {this.props.section === COLLECTIONS ? <CollectionList token={this.props.token} /> : null}
                </div>
            </div>
        );
    }
}

export default Editor;