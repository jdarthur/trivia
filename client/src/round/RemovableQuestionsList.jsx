import React from 'react';
import './OpenRound.css';
import RemovableQuestion from "./RemovableQuestion"

import { Button, Empty } from 'antd';

import {
    DeleteOutlined
} from '@ant-design/icons';

class RemovableQuestionsList extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            selected_questions: []
        }
    }

    select_item = (question_id) => {
        const index = this.state.selected_questions.indexOf(question_id)
        if (index === -1) {
            this.state.selected_questions.push(question_id)
        }
        else {
            this.state.selected_questions.splice(index, 1)
        }
        this.setState({ selected_questions: this.state.selected_questions })
    }

    remove_selected = () => {
        if (this.state.selected_questions.length > 0) {
            this.props.remove_questions(this.state.selected_questions)
            this.setState({ selected_questions: [] })
        }
    }

    render() {
        const questions = this.props.questions.map((question_id) => (
            <RemovableQuestion key={question_id} id={question_id} select={this.select_item}
                selected={this.state.selected_questions.indexOf(question_id) !== -1}
                token={this.props.token}
            />)
        )
        const show_empty = this.props.questions.length > 0 ? false : true

        return (
            <div className={"rem-question-list" + show_empty? " centered" : ""}  >
                {show_empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No questions added"/> : questions }

                {this.state.selected_questions.length > 0 ?
                    <Button className="new_button" danger onClick={this.remove_selected} >
                        <DeleteOutlined />  Remove selected
                    </Button> : null}


            </div>
        );
    }
}

export default RemovableQuestionsList;