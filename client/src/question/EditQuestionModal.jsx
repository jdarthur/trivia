import React from 'react';
import './Question.css';

import { Input, Button, Modal, Radio } from 'antd';
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;

//JSON keys
const CATEGORY = "category"
const QUESTION = "question"
const ANSWER = "answer"

const EDIT = "Edit"
const PREVIEW = "Preview"

class EditQuestionModal extends React.Component {

    state = {
        selected: EDIT
    }


    set_category = (event) => { this.set_value(event, CATEGORY) }
    set_question = (event) => { this.set_value(event, QUESTION) }
    set_answer = (event) => { this.set_value(event, ANSWER) }
    set_value = (event, key) => { this.props.set(this.props.id, key, event.target.value) }

    delete_self = () => { this.props.delete(this.props.id) }
    save_self = () => { this.props.select("") }

    set_edit = (event) => { this.setState({ selected: event.target.value }) }

    category_enter = (event) => { this.handleEnter(event, CATEGORY) }
    question_enter = (event) => { this.handleEnter(event, QUESTION) }
    answer_enter = (event) => { this.handleEnter(event, ANSWER) }

    handleEnter = (event, source) => {
        if (event.shiftKey && (source === QUESTION || source === ANSWER)) {
            console.log("alt-enter")
        }
        else {
            event.preventDefault()
            this.save_self()
        }
    }

    is_empty = () => {
        return this.props.category === "" && this.props.question === "" && this.props.answer === ""
    }

    render() {
        const title = this.props.id === "new" ? "Add question" : "Edit question"
        const save_text = this.props.id === "new" ? "Add" : "Update"

        const cancel_action = this.is_empty() ? this.delete_self : this.save_self

        const footer = <div className="save-delete">
            <Button danger className="button" onClick={this.delete_self}> Delete</Button>
            <Button className="button" type="primary" onClick={this.save_self}> {save_text} </Button>
        </div>

        const view = this.state.selected === EDIT ?
            <div>
                <TextArea placeholder="Question" value={this.props.question} style={{ marginBottom: 10 }}
                    onChange={this.set_question} autoSize={{ minRows: 4 }} onPressEnter={this.question_enter} />
                <TextArea placeholder="Answer" value={this.props.answer} autoSize={{ minRows: 2 }}
                    onChange={this.set_answer} onPressEnter={this.answer_enter} />
            </div> :
            <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
                <ReactMarkdown source={this.props.question} />
                <ReactMarkdown source={this.props.answer} className="answer" />
            </div>

        return (
            <Modal
                title={title}
                onOk={this.save_self}
                visible={true}
                onCancel={cancel_action}
                footer={footer}
                width="400px">

                <Input placeholder="Category" value={this.props.category} style={{ marginBottom: 10 }}
                    onChange={this.set_category} onPressEnter={this.category_enter} />

                <Radio.Group buttonStyle="solid" onChange={this.set_edit} value={this.state.selected}
                    defaultValue={EDIT} size="small" style={{ paddingBottom: 5 }}>
                    <Radio.Button key={EDIT} value={EDIT} > {EDIT} </Radio.Button>
                    <Radio.Button key={PREVIEW} value={PREVIEW} > {PREVIEW} </Radio.Button>
                </Radio.Group>


                {view}


            </Modal>


        );
    }
}

export default EditQuestionModal