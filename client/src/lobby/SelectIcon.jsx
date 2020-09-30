import React from 'react';
import './Lobby.css';

import { ICONS } from "./Icons.js"

import { Select } from 'antd';

const { Option } = Select;
/**
 * This is a dropdown to select a player icon in the game lobby
 * @author JD Arthur
 * @date 26 Sep 2020
 */
class SelectIcon extends React.Component {

    select = (value) => {
        this.props.select(value)
        console.log("select " + value)
    }
    render() {
        const options = []
        for (let key in ICONS) {
            const icon = ICONS[key]
            if (!this.props.excluded_icons.includes(key)) {
                options.push(<Option key={key} value={key} title=""> {icon} </Option>)
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