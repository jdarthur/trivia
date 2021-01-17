import React from 'react';

import { Button, Popover } from 'antd'

import {
    DeleteOutlined
} from '@ant-design/icons';


class DeleteConfirm extends React.Component {

    state = { open: false }
    open = () => { this.setState({ open: true }) }
    cancel = () => { this.setState({ open: false }) }
    delete = () => {
        this.props.delete()
        this.setState({ open: false })
    }

    render() {
        const content = <div>
            <Button onClick={this.cancel} style={{ marginRight: 10 }}> Cancel </Button>
            <Button type="primary" danger onClick={this.delete} > Delete </Button>
        </div>

        const style = { paddingRight: 5, ...this.props.style }

        return (
            <Popover content={content} title={null} trigger="click" visible={this.state.open}>
                <DeleteOutlined style={style} onClick={this.open} />
            </Popover>
        );
    }
}

export default DeleteConfirm;