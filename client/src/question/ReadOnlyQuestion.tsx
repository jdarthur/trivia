import React from 'react';
import { Card } from 'antd';

import QuestionBody from "./QuestionBody";
import CategoryName from "../category/CategoryName";

import {
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons';

import './Question.css';

interface Props {
    id: string
    question: string
    answer: string
    category: string
    selected?: boolean
    hide_extra?: boolean
    select?: (id: string) => void
    delete?: (id: string) => void
    question_type?: string
    choices?: { text: string, is_correct: boolean }[]
    pairs?: { left: string, right: string }[]
    buckets?: { text: string }[]
    items?: { text: string, bucket: string }[]
    ordered?: { text: string }[]
}

class ReadOnlyQuestion extends React.Component<Props> {

    select_self = () => {
        this.props.select?.(this.props.id)
    }

    delete_self = () => {
        this.props.delete?.(this.props.id)
    }

    render() {
        // const containerClass = (this.props.selected ? "selected" : "")
        const background = this.props.selected ? "#d9d9d9" : ""
        const cursor = this.props.hide_extra ? "pointer" : ""
        const edit = this.props.hide_extra ? null : <div>
            <DeleteOutlined onClick={this.delete_self} className="delete-edit-mini" />
            <EditOutlined onClick={this.select_self} className="delete-edit-mini" />
        </div>
        return (
            // category is the category's ID on the question wire format
            // (ticket #180); the card title resolves it to the name.
            <Card title={<CategoryName id={this.props.category}/>} size="small" extra={edit}
                style={{ width: 225, margin: 5, background: background, cursor: cursor }}>
                <QuestionBody question={this.props.question}
                              answer={this.props.answer}
                              question_type={this.props.question_type}
                              choices={this.props.choices}
                              pairs={this.props.pairs}
                              buckets={this.props.buckets}
                              items={this.props.items}
                              ordered={this.props.ordered}
                              max_width={200}
                              show_answer/>
            </Card>
        );
    }
}

export default ReadOnlyQuestion
