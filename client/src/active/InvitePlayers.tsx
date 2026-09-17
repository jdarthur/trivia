import React from 'react';
import {Button, Input, Modal} from 'antd';
import {CopyOutlined, UserAddOutlined} from '@ant-design/icons';

interface Props {
    session_id: string
}

interface State {
    open: boolean
}

// InvitePlayers is the moderator's mid-game "add a player" affordance
// (ticket #291): a button that reveals the invite link so a brand-new player
// can join an already-started game. The link format matches the lobby's
// InviteLink (`?session_id=<id>`, no player credential in the URL).
class InvitePlayers extends React.Component<Props, State> {
    state: State = {open: false}

    invite_link = () => {
        return window.location.href.split("?")[0] + "?session_id=" + this.props.session_id
    }

    copy = () => {
        navigator.clipboard?.writeText(this.invite_link())
    }

    render() {
        return (
            <React.Fragment>
                <Button type="primary" icon={<UserAddOutlined/>} onClick={() => this.setState({open: true})}>
                    Invite
                </Button>
                <Modal open={this.state.open} onCancel={() => this.setState({open: false})}
                       title="Invite a player" footer={null}>
                    <p>Share this link so a player can join the game:</p>
                    <Input.TextArea className="invite-link" readOnly value={this.invite_link()} autoSize/>
                    <Button icon={<CopyOutlined/>} onClick={this.copy} style={{marginTop: 8}}>
                        Copy
                    </Button>
                </Modal>
            </React.Fragment>
        )
    }
}

export default InvitePlayers;
