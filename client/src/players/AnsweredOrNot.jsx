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
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            {this.props.player_name}
        </div>
        return (
            <Card size="small" title={title} extra={icon}
                style={{ 'minWidth': 150 }} bodyStyle={{ padding: 15 }}  >
                <div className="answered-or-not"> {answer_icon} </div>
            </Card>
        );
    }
}

export default AnsweredOrNot;