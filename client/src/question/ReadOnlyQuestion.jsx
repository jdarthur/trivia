import React from 'react';
import './Question.css';
import { Card } from 'antd';

import {
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons';

class ReadOnlyQuestion extends React.Component {

    select_self = () => {
        this.props.select(this.props.id)
    }

    delete_self = () => {
        this.props.delete(this.props.id)
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
            <Card title={this.props.category} size="small" extra={edit}
            style={{ width: 225, margin: 5, background: background, cursor: cursor}}>
                <div>{this.props.question} </div>
                <div className="answer">{this.props.answer}</div>
            </Card>
        );
    }
}

export default ReadOnlyQuestion
