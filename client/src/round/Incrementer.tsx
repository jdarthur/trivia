import React from 'react';
import "./Wager.css"

import { InputNumber } from 'antd';

interface Props {
    index: number
    value: number
    set: (index: number, value: number, save: boolean) => void
}

class Incrementer extends React.Component<Props> {

    set_value = (value: number | null) => {
        this.props.set(this.props.index, value as number, false)
    }

    render() {
        return (
            <InputNumber min={1} value={this.props.value} onChange={this.set_value}
              style={{'margin-right': 5, 'margin-top': 5} as any} />
        );
    }
}

export default Incrementer
