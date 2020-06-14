import React from 'react';
import "./OpenGame.css"
import RoundInGame from './RoundInGame';

/**
 * This is a round inside of an open game. It shows
 * its questions and can be deleted from the game.
 * It also has a game-specific name that can be edited.
 */

class RemovableRound extends React.Component {

    set_name = (event) => {
        this.props.set_round_name(this.props.id, event.target.value)
    }

    keydown = (event) => {
        this.props.handleKeyPress(event)
    }

    render() {
        return (
            <div className="removable-round">
                <input value={this.props.name} onChange={this.set_name}
                onKeyDown={this.keydown} placeholder="Name" />
                <RoundInGame key={this.props.id} id={this.props.id} select={this.props.select}
                    selected={this.props.selected} show_title={false} />
            </div>
        );
    }
}

export default RemovableRound
