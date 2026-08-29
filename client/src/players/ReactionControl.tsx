import React from 'react';
import {Popover, Tooltip} from "antd";
import EmojiPicker, {EmojiStyle} from "emoji-picker-react";
import sendData from "../index";
import "./Players.css"
import type {ReactionSummary} from "../types/models";

interface Props {
    session_id: string
    // current_player is the viewer's own player id (the person reacting) —
    // NOT the player the answer card belongs to.
    current_player: string
    answer_id?: string
    reactions?: Record<string, ReactionSummary>
    my_reaction?: string
}

interface State {
    picker_open: boolean
}

/**
 * Emoji reactions on one scored answer (ticket #156). Rendered as stickers
 * "stuck" across the top of the answer box, starting at the top-right corner
 * and flowing leftward; the "+" button sits at the right side of the answer.
 * Hovering a sticker shows the team names of the players who reacted with it.
 * The caller's own reaction is highlighted; a "+" button opens an emoji
 * picker (emoji-picker-react) in a Popover so the small answer cards don't
 * carry the full picker UI.
 *
 * The API allows exactly one emoji per (answer, player): tapping the
 * highlighted chip removes the reaction, picking a different emoji changes it
 * (PUT upserts on UNIQUE(answer_id, player_id)), and picking the same emoji
 * again is treated as a remove (toggle). Each mutation bumps the session
 * state token, so the existing session_state refetch pattern propagates the
 * new counts to every client — no optimistic update needed.
 */
class ReactionControl extends React.Component<Props, State> {

    state: State = {picker_open: false}

    // PUT creates or modifies (upsert); DELETE removes. Fire-and-forget like
    // the other gameplay mutations — the state-token bump drives a refetch.
    // Failures are logged (and the picker still closes); the player can retry.
    set_reaction = (emoji: string) => {
        const {session_id, current_player, answer_id, my_reaction} = this.props
        if (!answer_id) return
        const url = "/gameplay/session/" + session_id + "/reaction"
        if (emoji === my_reaction) {
            sendData(url, "DELETE", {answer_id, player_id: current_player})
                .catch((error) => console.error("Failed to remove reaction:", error))
        } else {
            sendData(url, "PUT", {answer_id, player_id: current_player, emoji})
                .catch((error) => console.error("Failed to set reaction:", error))
        }
        this.setState({picker_open: false})
    }

    remove_reaction = () => {
        const {session_id, current_player, answer_id} = this.props
        if (!answer_id) return
        sendData("/gameplay/session/" + session_id + "/reaction", "DELETE", {
            answer_id, player_id: current_player
        }).catch((error) => console.error("Failed to remove reaction:", error))
    }

    render() {
        const {answer_id, reactions, my_reaction} = this.props
        if (!answer_id) return null

        const stickers = Object.entries(reactions || {})
            .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
            .map(([emoji, summary]) => {
                const mine = emoji === my_reaction
                // Who reacted: the team names the API aggregates per emoji.
                // Hovering the sticker reveals them (tooltip).
                const who = summary.players && summary.players.length > 0
                    ? summary.players.join(', ')
                    : undefined
                const chip = (
                    <span key={emoji} className={"reaction-chip" + (mine ? " mine" : "")}
                          onClick={mine ? this.remove_reaction : undefined}>
                        {emoji} {summary.count}
                    </span>
                )
                return who ? <Tooltip key={emoji} title={who}>{chip}</Tooltip> : chip
            })

        const picker = (
            <EmojiPicker width={300} height={320} emojiStyle={EmojiStyle.NATIVE}
                         showPreview={false}
                         onEmojiClick={(data) => this.set_reaction(data.emoji)}/>
        )

        return (
            <div className="reaction-control">
                <div className="reaction-stickers">{stickers}</div>
                <div className="reaction-add">
                    <Popover content={picker} trigger="click" open={this.state.picker_open}
                             onOpenChange={(open) => this.setState({picker_open: open})}>
                        <button type="button" className="reaction-add-button" aria-label="Add reaction">+</button>
                    </Popover>
                </div>
            </div>
        )
    }
}

export default ReactionControl;
