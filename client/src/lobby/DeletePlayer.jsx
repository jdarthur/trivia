import React from 'react';

import {Button, Popover} from 'antd'

import {
    DeleteOutlined
  } from '@ant-design/icons';


class ScorerLink extends React.Component {

    state = { open: false }

    open = () => { this.setState({open: true}) }
    cancel = () => { this.setState({open: false}) }
    delete = () => {
        console.log("Delete session " + this.props.session_id + " / user " +  this.props.player_id + " as admin " + this.props.admin_id)
        deletePlayer(this.props.session_id, this.props.player_id, this.props.admin_id)
    }

    render() {
        const content = <div>
            <Button onClick={this.cancel} style={{marginRight: 10}}> Cancel </Button>
            <Button type="primary" danger onClick={this.delete} > Delete </Button>
        </div>

        return (
            <Popover content={content} title={null} trigger="click" visible={this.state.open}>
            <DeleteOutlined style={{paddingRight: 5}} onClick={this.open}/>
          </Popover>
        );
    }
}

async function deletePlayer(session_id, player_id, admin_id) {
    const url = "/gameplay/session/" + session_id + "/remove"

    const data = {
        admin_id: admin_id,
        player_id: player_id,
    }
    let body = JSON.stringify(data)

    const response = await fetch(url, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: body
    })
    return response.json()
  }

export default ScorerLink;