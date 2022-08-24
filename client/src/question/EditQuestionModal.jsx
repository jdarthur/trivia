import React, {useState} from 'react';
import './Question.css';

import {Input, Modal, Radio} from 'antd';
import FormattedQuestion from "./FormattedQuestion"
import EditorToolbar from "./EditorToolbar";
import {ANSWER, CATEGORY, QUESTION} from "./EditQuestionController";

const {TextArea} = Input;

const EDIT = "Edit"
const PREVIEW = "Preview"

export default function EditQuestionModal(props) {

    const [selectedTab, setSelectedTab] = useState(EDIT)
    const [focusedInput, setFocusedInput] = useState(CATEGORY)

    // componentDidMount() {
    //     let active = "";
    //     if (document.activeElement.id === CATEGORY) {
    //         active = CATEGORY
    //     }
    //     if (document.activeElement.id === QUESTION) {
    //         active = QUESTION
    //     }
    //     if (document.activeElement.id === ANSWER) {
    //         active = ANSWER
    //     }
    //
    //     this.setState({focused: active})
    // }




    // const handleEnter = (event, source) => {
    //     if (event.shiftKey && (source === QUESTION || source === ANSWER)) {
    //         console.log("alt-enter")
    //     } else {
    //         event.preventDefault()
    //         props.save_action()
    //     }
    // }

    const wrap = (wrapWith) => {
        const activeElement = document.getElementById(focusedInput)
        if (activeElement) {
            const selectionStart = activeElement.selectionStart
            const selectionEnd = activeElement.selectionEnd
            if (activeElement.id === QUESTION) {
                const value = wrapValue(props.question, selectionStart, selectionEnd, wrapWith)
                console.log(value)
                props.set_question(value)
            }
            if (activeElement.id === ANSWER) {
                props.set_answer(wrapValue(props.answer, selectionStart, selectionEnd, wrapWith))
            }
        }
    }

    const wrap_line = (wrapWithBefore, wrapWithAfter) => {
        const activeElement = document.getElementById(focusedInput)
        if (activeElement) {
            const selectionStart = activeElement.selectionStart
            const selectionEnd = activeElement.selectionEnd

            if (activeElement.id === QUESTION) {
                let value = props.question.slice(0, selectionStart)
                const selected = props.question.slice(selectionStart, selectionEnd)
                const selected_lines = selected.split("\n")

                selected_lines.forEach(line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                props.set_question(value + props.question.slice(selectionEnd))
            }
            if (activeElement.id === ANSWER) {
                let value = props.answer.slice(0, selectionStart)
                const selected = props.answer.slice(selectionStart, selectionEnd)
                const selected_lines = selected.split("\n")

                selected_lines.forEach(line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                props.set_answer(value + props.answer.slice(selectionEnd))
            }
        }
    }

    const insert = (text) => {
        const activeElement = document.getElementById(focusedInput)
        if (activeElement) {
            if (activeElement.id === QUESTION || activeElement.id === CATEGORY) {
                props.set_question(props.question + text)
            }
            if (activeElement.id === ANSWER) {
                props.set_answer(props.answer + text)
            }
        }
    }


    const view = selectedTab === EDIT ?
        <div>
            <TextArea autoFocus={props.category} placeholder="Question" value={props.question}
                      style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                      onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                      onPressEnter={null}/>

            <TextArea autoFocus={props.category && props.question && !props.answer}
                      placeholder="Answer" value={props.answer} autoSize={{minRows: 2}}
                      onClick={() => setFocusedInput(ANSWER)} onChange={(event) => props.set_answer(event.target.value)}
                      onPressEnter={null} id={ANSWER}/>
        </div> :
        <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
            <FormattedQuestion question={props.question}
                               answer={props.answer} max_width={425}/>
        </div>

    return (
        <Modal
            visible={props.visible}
            onOk={props.save}
            title={props.title}
            onCancel={props.cancel}
            footer={props.footer}
            width="500px">

            <div style={{display: "flex", flexDirection: "column"}}>
                <Input autoFocus={!props.category} placeholder="Category" value={props.category}
                       style={{marginBottom: 10, width: 300}} onClick={setFocusedInput} id={CATEGORY}
                       onChange={(event) => props.set_category(event.target.value)} onPressEnter={null}/>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>

                            <Radio.Group buttonStyle="solid" onChange={(event) => setSelectedTab(event.target.value)}
                                         value={selectedTab}
                                         defaultValue={EDIT} size="small">
                                <Radio.Button key={EDIT} value={EDIT}> {EDIT} </Radio.Button>
                                <Radio.Button key={PREVIEW} value={PREVIEW}> {PREVIEW} </Radio.Button>
                            </Radio.Group>

                            <EditorToolbar wrap={wrap} wrap_line={wrap_line} insert={insert}/>
                        </span>

                {view}
            </div>
        </Modal>
    );

}

function wrapValue(value, fromIndex, toIndex, withValue) {
    return [value.slice(0, fromIndex),
        withValue, value.slice(fromIndex, toIndex), withValue,
        value.slice(toIndex)].join("")
}
