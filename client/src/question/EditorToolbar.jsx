import React from 'react';
import './Question.css';

import {CodeOutlined, PictureOutlined, SoundOutlined, UnorderedListOutlined} from '@ant-design/icons';
import {Tooltip} from "antd";

class EditorToolbar extends React.Component {

    bold = () => {
        this.props.wrap("**")
    }
    italicize = () => {
        this.props.wrap("_")
    }
    strikethrough = () => {
        this.props.wrap("~~")
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
        document.getElementById("image_upload").click()
    }

    audio = () => {
        document.getElementById("audio_upload").click()
    }


    insert_image = (event) => {
        const file = event.target.files[0]
        event.target.value = null

        uploadFile(file).then((data) => {
            console.log(data)
            this.props.insert("![image](" + data.filename + ")")
        })
    }

    insert_audio = (event) => {
        const file = event.target.files[0]
        event.target.value = null

        uploadFile(file).then((data) => {
            console.log(data)
            this.props.insert("[audio file](" + data.filename + ")")
        })
    }

    render() {

        const bold = <button className="editor-toolbar-button" style={{fontWeight: "bold"}}
                             onClick={this.bold}> B </button>
        const italics = <button className="editor-toolbar-button" style={{fontStyle: "italic"}}
                                onClick={this.italicize}> I </button>
        const strikethrough = <button className="editor-toolbar-button" onClick={this.strikethrough}
                                      style={{textDecoration: "line-through"}}> S </button>
        const quote = <Tooltip
            title={"Enclose the selected text in a block quote to contextualize the text or to allow precise linebreaks"}>
            <button className="editor-toolbar-button" onClick={this.quote}
                    style={{fontSize: "1.5em", paddingBottom: -3}}> “
            </button>
        </Tooltip>
        const picture =
            <Tooltip
                title={"Upload an embedded image. Change the text between the square brackets afterwards to customize the alt text displayed on mouseover."}>
                <PictureOutlined className="editor-toolbar-button" onClick={this.image}/>
            </Tooltip>


        const audio =
            <Tooltip
                title={"Upload an MP3 or WAV file for audio-based questions. Change the text between the square brackets afterwards to customize the text of the hyperlink."}>
                <SoundOutlined className="editor-toolbar-button" onClick={this.audio}/>
            </Tooltip>
        const code = <span>
            <input id="image_upload" type="file" style={{display: "none"}} accept="image/png, image/jpeg, image/gif"
                   onInput={this.insert_image}/>
            <input id="audio_upload" type="file" style={{display: "none"}}
                   accept="audio/mpeg, audio/wav"
                   onInput={this.insert_audio}/>
            <CodeOutlined className="editor-toolbar-button" onClick={this.code}/>
        </span>


        const bullet = <UnorderedListOutlined className="editor-toolbar-button" onClick={this.bullet}/>

        return (
            <span style={{alignItems: "center"}}>
                {bold}
                {italics}
                {strikethrough}
                {bullet}
                {quote}
                {code}
                {picture}
                {audio}
            </span>
        );
    }
}

async function uploadFile(file) {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch("/editor/file", {
        method: "POST",
        body: formData
    })

    return response.json()
}


export default EditorToolbar
