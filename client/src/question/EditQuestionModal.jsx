import React from 'react';
import './Question.css';

import { Input, Modal, Radio } from 'antd';
import FormattedQuestion from "./FormattedQuestion"

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
    set_value = (event, key) => { this.props.set(key, event.target.value) }

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
            this.props.save_action()
        }
    }

    render() {

        const view = this.state.selected === EDIT ?
            <div>
                <TextArea autoFocus={this.props.category} placeholder="Question" value={this.props.question} style={{ marginBottom: 10 }}
                    onChange={this.set_question} autoSize={{ minRows: 4 }} onPressEnter={this.question_enter} />
                <TextArea autoFocus={this.props.category && this.props.question && !this.props.answer}
                    placeholder="Answer" value={this.props.answer} autoSize={{ minRows: 2 }}
                    onChange={this.set_answer} onPressEnter={this.answer_enter} />
            </div> :
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 2, padding: 10 }}>
                <FormattedQuestion question={this.props.question}
                    answer={this.props.answer} max_width={425} />
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
                           style={{ marginBottom: 10, width: 300}}
                           onChange={this.set_category} onPressEnter={this.category_enter} />

                    <Radio.Group buttonStyle="solid" onChange={this.set_edit} value={this.state.selected}
                                 defaultValue={EDIT} size="small" style={{ paddingBottom: 5 }}>
                        <Radio.Button key={EDIT} value={EDIT} > {EDIT} </Radio.Button>
                        <Radio.Button key={PREVIEW} value={PREVIEW} > {PREVIEW} </Radio.Button>
                    </Radio.Group>
                    {view}
                </div>


            </Modal>


        );
    }
}

export default EditQuestionModal