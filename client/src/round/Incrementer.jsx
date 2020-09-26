import React from 'react';
import "./Wager.css"

import { InputNumber } from 'antd';

class Incrementer extends React.Component {

    set_value = (value) => {
        this.props.set(this.props.index, value, false)
    }

    render() {
        return (
            <InputNumber min={1} value={this.props.value} onChange={this.set_value} />
        );
    }
}

export default Incrementer