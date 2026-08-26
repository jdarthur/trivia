import React from 'react';
import { Card } from 'antd';

import FormattedQuestion from "./FormattedQuestion";
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
                <FormattedQuestion question={this.props.question}
                    answer={this.props.answer} max_width={200} />
                {this.props.question_type === "multiple_choice" && (this.props.choices || []).length > 0 ?
                    <ol style={{marginTop: 8, paddingLeft: 18}}>
                        {(this.props.choices || []).map((choice, index) => <li key={index}>{choice.text}</li>)}
                    </ol> : null}
                {this.props.question_type === "matching" && (this.props.pairs || []).length > 0 ?
                    <table style={{marginTop: 8, borderCollapse: "collapse"}}>
                        {(this.props.pairs || []).map((pair, index) => (
                            <tr key={index}>
                                <td style={{border: "1px solid #d9d9d9", padding: "2px 6px"}}>{pair.left}</td>
                                <td style={{border: "1px solid #d9d9d9", padding: "2px 6px"}}>{pair.right}</td>
                            </tr>
                        ))}
                    </table> : null}
                {this.props.question_type === "bucketing" && (this.props.items || []).length > 0 ?
                    <table style={{marginTop: 8, borderCollapse: "collapse"}}>
                        {(this.props.items || []).map((item, index) => (
                            <tr key={index}>
                                <td style={{border: "1px solid #d9d9d9", padding: "2px 6px"}}>{item.text}</td>
                                <td style={{border: "1px solid #d9d9d9", padding: "2px 6px"}}>{item.bucket}</td>
                            </tr>
                        ))}
                    </table> : null}
            </Card>
        );
    }
}

export default ReadOnlyQuestion
