import React from 'react';
import PlayerIcon from '../lobby/PlayerIcon';
import "./Players.css"
import { Card } from "antd"

import {
    CheckOutlined,
    MinusOutlined
} from '@ant-design/icons';

class AnsweredOrNot extends React.Component {

    render() {
        const icon = <div className="delete-edit-mini" >
            <PlayerIcon icon_name={this.props.icon_name} />
        </div>
        const answer_icon = this.props.answered ? <CheckOutlined /> : <MinusOutlined />
        return (
            <Card size="small" title={this.props.player_name} extra={icon}
                style={{ 'min-width': 150 }} bodyStyle={{ padding: 15 }}  >
                <div className="answered-or-not"> {answer_icon} </div>
            </Card>
        );
    }
}

export default AnsweredOrNot;