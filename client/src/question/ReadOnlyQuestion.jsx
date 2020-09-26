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
        const edit = this.props.hide_extra ? null : <div>
            <DeleteOutlined onClick={this.delete_self} className="delete-edit-mini" />
            <EditOutlined onClick={this.select_self} className="delete-edit-mini" />
        </div>
        return (
            <Card title={this.props.category} size="small" extra={edit} style={{ width: 200, margin: 5, background: background }}>
                <p>{this.props.question} </p>
                <p className="answer">{this.props.answer}</p>
            </Card>
        );
    }
}

export default ReadOnlyQuestion
