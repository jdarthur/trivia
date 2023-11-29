import React from 'react';
import PlayerIcon from '../lobby/PlayerIcon';
import "./Players.css"
import {Card, Tooltip} from "antd"

import {
    CheckOutlined,
    MinusOutlined
} from '@ant-design/icons';
import ShortTextWithPopover from "../common/ShortTextWithPopover";

class AnsweredOrNot extends React.Component {

    render() {
        const icon = <div className="delete-edit-mini">
            <PlayerIcon icon_name={this.props.icon_name}/>
        </div>
        const answer_icon = this.props.answered ? <CheckOutlined/> : <MinusOutlined/>
        const is_self = this.props.player_id === this.props.current_player
        const title = <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            {is_self ? <span className="self-indicator"> • </span> : null}
            <ShortTextWithPopover text={this.props.player_name} maxLength={20}/>
        </div>
        return (
            <div style={{display: 'flex', alignItems: 'stretch'}}>
                {this.props.is_mobile ?
                    // show mini status on mobile
                    <Tooltip title={this.props.player_name}>
                        <Card style={{width: 65}}
                              bodyStyle={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0}}>
                            <span style={{display: 'flex', padding: 5}}>
                                {is_self ? <span className="self-indicator"> • </span> : null}
                                {icon}
                            </span>
                            <div style={{padding: 5}}> {answer_icon} </div>
                        </Card>
                    </Tooltip> :
                    //show full version with full answers
                    <Card size="small" title={title} extra={icon}
                          style={{
                              minWidth: 150,
                              maxWidth: 300,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between'
                          }}>

                        <div className="answered-or-not"> {answer_icon} </div>

                    </Card>}
            </div>
        );
    }
}

export default AnsweredOrNot;