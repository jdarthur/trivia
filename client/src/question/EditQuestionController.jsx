import React from 'react';
import './Question.css';

import {Button} from 'antd';
import EditQuestionModal from "./EditQuestionModal";

class EditQuestionController extends React.Component {

    set_value = (key, value) => { this.props.set(this.props.id, key, value) }

    delete_self = () => {
        this.props.delete(this.props.id)
    }
    save_self = () => {
        this.props.select("")
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


        return (
            <EditQuestionModal title={title} cancel_action={cancel_action}
                               save_text={save_text} save_action={this.save_self}
                               question={this.props.question} answer={this.props.answer}
                               category={this.props.answer} footer={footer}
                               set={this.set_value}/>
        );
    }
}

export default EditQuestionController