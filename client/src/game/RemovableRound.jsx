import React from 'react';
import "./OpenGame.css"
import RoundInGame from './RoundInGame';
import {Input} from "antd"

import {DeleteOutlined} from '@ant-design/icons';

/**
 * This is a round inside of an open game. It shows
 * its questions and can be deleted from the game.
 * It also has a game-specific name that can be edited.
 */

class RemovableRound extends React.Component {

    set_name = (event) => {
        event.preventDefault()
        this.props.set_round_name(this.props.id, event.target.value)
    }

    select_self = () => {
        this.props.select(this.props.id)
    }

    keydown = (event) => {
        this.props.handleKeyPress(event)
    }

    render() {

        const border = this.props.selected ? "2px solid black" : ""

        return (
            <div className="removable-round" style={{border: border}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <Input value={this.props.name} onChange={this.set_name}
                           onKeyDown={this.keydown} placeholder="Round name" style={{width: 150}}/>

                    <DeleteOutlined style={{fontSize: '1.5em', marginRight: 10}} onClick={this.select_self}/>

                </span>
                <RoundInGame key={this.props.id} id={this.props.id}
                             selected={this.props.selected} show_title={false}/>
            </div>
        );
    }
}

export default RemovableRound
