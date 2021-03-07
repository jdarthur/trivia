import React from 'react';
import './Question.css';

import {CodeOutlined, PictureOutlined, UnorderedListOutlined} from '@ant-design/icons';

class EditorToolbar extends React.Component {

    bold = () => {
        this.props.wrap("**")
    }
    italicize = () => {
        this.props.wrap("_")
    }
    strikethrough = () => {
        this.props.wrap("~")
    }
    code = () => {
        this.props.wrap("\n```\n")
    }
    quote = () => {
        this.props.wrap_line("> ", "\n> \n")
    }
    bullet = () => {
        this.props.wrap_line(" - ", "\n")
    }

    image = () => {
        //select image from file picker
        //upload as binary to POST /editor/image
        //get response from API call, e.g. /images/e95b2bc6-fba7-4472-b1f3-20e20c32905e.png
        const image = "image.png"
        this.props.transform("![image](" + image + ")")
    }

    render() {

        const bold = <button className="editor-toolbar-button" style={{fontWeight: "bold"}} onClick={this.bold}> B </button>
        const italics = <button className="editor-toolbar-button" style={{fontStyle: "italic"}} onClick={this.italicize}> I </button>
        const strikethrough = <button className="editor-toolbar-button" onClick={this.strikethrough}
                                      style={{textDecoration: "line-through"}}> S </button>
        const quote = <button className="editor-toolbar-button" onClick={this.quote}
                              style={{fontSize: "1.5em", paddingBottom: -3}}> “ </button>
        const picture = <PictureOutlined className="editor-toolbar-button"/>
        const code = <CodeOutlined className="editor-toolbar-button" onClick={this.code}/>
        const bullet = <UnorderedListOutlined className="editor-toolbar-button" onClick={this.bullet} />

        return (
            <span style={{alignItems: "center"}}>
                {bold}
                {italics}
                {strikethrough}
                {bullet}
                {quote}
                {code}
                {picture}
            </span>
        );
    }
}

export default EditorToolbar