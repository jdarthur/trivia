import React from 'react';
import './Lobby.css';

import {Button, Card, Input, Tooltip} from 'antd';
import {CopyOutlined, InfoCircleOutlined} from '@ant-design/icons';


const INVITE_LINK = "inviteLink"

class InviteLink extends React.Component {

    copy_link = () => {
        const copyText = document.getElementById(INVITE_LINK);

        copyText.select();
        copyText.setSelectionRange(0, 99999); /*For mobile devices*/

        /* Copy the text inside the text field */
        document.execCommand("copy");
    }

    invite_link = () => {
        return window.location.href.split("?")[0] + "?session_id=" + this.props.session_id
    }


    render() {

        const cardTitle = <Tooltip title={"Copy this link and share it to invite players to the game"}
                                   placement={"right"}>
            Invite Link
            <InfoCircleOutlined style={{marginLeft: "0.5em"}}/>
        </Tooltip>

        return (
            <div className="invite">
                <Card title={cardTitle}>
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <Input.TextArea className="invite-link" id={INVITE_LINK} readOnly value={this.invite_link()}
                                        autoSize={true}/>
                        <Button className="invite-button" onClick={this.copy_link}>
                            <CopyOutlined/>
                            Copy
                        </Button>
                    </div>

                </Card>

            </div>
        );
    }
}

export default InviteLink;