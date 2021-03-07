import React from 'react';
import './Question.css';

import {Input, Modal, Radio} from 'antd';
import FormattedQuestion from "./FormattedQuestion"
import EditorToolbar from "./EditorToolbar";

const {TextArea} = Input;

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

const EDIT = "Edit"
const PREVIEW = "Preview"

class EditQuestionModal extends React.Component {

    state = {
        selected: EDIT,
        focused: CATEGORY
    }

    componentDidMount() {
        let active = "";
        if (document.activeElement.id === CATEGORY) {
            active = CATEGORY
        }
        if (document.activeElement.id === QUESTION) {
            active = QUESTION
        }
        if (document.activeElement.id === ANSWER) {
            active = ANSWER
        }

        this.setState({focused: active})
    }

    set_category = (event) => {
        this.set_value(event, CATEGORY)
    }
    set_question = (event) => {
        this.set_value(event, QUESTION)
    }
    set_answer = (event) => {
        this.set_value(event, ANSWER)
    }
    set_value = (event, key) => {
        this.props.set(key, event.target.value)
    }

    set_focused = (event) => {
        this.setState({focused: event.target.id})
    }

    set_edit = (event) => {
        this.setState({selected: event.target.value})
    }

    category_enter = (event) => {
        this.handleEnter(event, CATEGORY)
    }
    question_enter = (event) => {
        this.handleEnter(event, QUESTION)
    }
    answer_enter = (event) => {
        this.handleEnter(event, ANSWER)
    }

    handleEnter = (event, source) => {
        if (event.shiftKey && (source === QUESTION || source === ANSWER)) {
            console.log("alt-enter")
        } else {
            event.preventDefault()
            this.props.save_action()
        }
    }

    wrap = (wrapWith) => {
        const activeElement = document.getElementById(this.state.focused)
        if (activeElement) {
            const selectionStart = activeElement.selectionStart
            const selectionEnd = activeElement.selectionEnd
            if (activeElement.id === QUESTION) {
                this.props.set(QUESTION, wrap(this.props.question, selectionStart, selectionEnd, wrapWith))
            }
            if (activeElement.id === ANSWER) {
                this.props.set(ANSWER, wrap(this.props.answer, selectionStart, selectionEnd, wrapWith))
            }
        }
    }

    wrap_line = (wrapWithBefore, wrapWithAfter) => {
        const activeElement = document.getElementById(this.state.focused)
        if (activeElement) {
            const selectionStart = activeElement.selectionStart
            const selectionEnd = activeElement.selectionEnd

            if (activeElement.id === QUESTION) {
                const lines = this.props.question.split("\n")
                console.log(lines)
                let value = this.props.question.slice(0, selectionStart)
                lines.forEach( line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                this.props.set(QUESTION, value + this.props.question.slice(selectionEnd))
            }
            if (activeElement.id === ANSWER) {
                const lines = this.props.answer.split("\\n")
                let value = this.props.answer.slice(0, selectionStart)
                lines.forEach( line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                this.props.set(ANSWER, value + this.props.answer.slice(selectionEnd))
            }
        }
    }


    render() {

        const view = this.state.selected === EDIT ?
            <div>
                <TextArea autoFocus={this.props.category} placeholder="Question" value={this.props.question}
                          style={{marginBottom: 10}} id={QUESTION} onClick={this.set_focused}
                          onChange={this.set_question} autoSize={{minRows: 4}} onPressEnter={this.question_enter}/>
                <TextArea autoFocus={this.props.category && this.props.question && !this.props.answer}
                          placeholder="Answer" value={this.props.answer} autoSize={{minRows: 2}}
                          onClick={this.set_focused} onChange={this.set_answer}
                          onPressEnter={this.answer_enter} id={ANSWER}/>
            </div> :
            <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
                <FormattedQuestion question={this.props.question}
                                   answer={this.props.answer} max_width={425}/>
            </div>

        return (
            <Modal
                visible={true}
                onOk={this.props.save_action}
                title={this.props.title}
                onCancel={this.props.cancel_action}
                footer={this.props.footer}
                width="500px">

                <div style={{display: "flex", flexDirection: "column"}}>
                    <Input autoFocus={!this.props.category} placeholder="Category" value={this.props.category}
                           style={{marginBottom: 10, width: 300}} onClick={this.set_focused} id={CATEGORY}
                           onChange={this.set_category} onPressEnter={this.category_enter}/>
                    <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>

                            <Radio.Group buttonStyle="solid" onChange={this.set_edit}
                                         value={this.state.selected}
                                         defaultValue={EDIT} size="small">
                                <Radio.Button key={EDIT} value={EDIT}> {EDIT} </Radio.Button>
                                <Radio.Button key={PREVIEW} value={PREVIEW}> {PREVIEW} </Radio.Button>
                            </Radio.Group>

                            <EditorToolbar wrap={this.wrap} wrap_line={this.wrap_line}/>
                        </span>

                    {view}
                </div>


            </Modal>


        );
    }

}

function wrap(value, fromIndex, toIndex, withValue) {
    return [value.slice(0, fromIndex),
        withValue, value.slice(fromIndex, toIndex), withValue,
        value.slice(toIndex)].join("")
}

export default EditQuestionModal