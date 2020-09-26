import React from 'react';
import './Lobby.css';

import { ICONS } from "./Icons.js"

import { Select } from 'antd';

const { Option } = Select;

class SelectIcon extends React.Component {

    select = (value) => {
        this.props.select(value)
        console.log("select " + value)
    }
    render() {
        //const excluded_icons = []

        const options = []
        for (let key in ICONS) {
            const icon = ICONS[key]
            if (!this.props.excluded_icons.includes(key)) {
                options.push(<Option value={key} title=""> {icon} </Option>)
            }
        }

        return (
            < Select onChange={this.select} value={this.props.icon_name}
                     menuItemSelectedIcon={ICONS[this.props.icon_name]}>
               {options}
            </Select>
        );
    }
}

export default SelectIcon;