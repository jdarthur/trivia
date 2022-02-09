
import React from 'react';
import './Editor.css';

import { Button } from 'antd';
import { PlusSquareOutlined } from '@ant-design/icons';

class NewButton extends React.Component {

    render() {
        return (
            <Button type="primary" style={{
                marginLeft: 15, paddingLeft: 5, paddingRight: 5,
                display: "flex", flexDirection: "row", alignItems: "center",
            }}  onClick={this.props.on_click}>
                <span style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <PlusSquareOutlined style={{ fontSize: "1.5em", paddingBottom: 0 }} />
                    <span style={{ paddingLeft: 10, paddingRight: 5 }}> New </span>
                </span>

            </Button>

        );
    }
}

export default NewButton;

