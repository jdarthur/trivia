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

/**
 * Emoji reactions on one scored answer (ticket #156), in two pieces that
 * anchor to different boxes:
 *
 * - `ReactionStickers` — the counts, rendered as stickers "stuck" across the
 *   top of the card starting at the top-right corner and flowing leftward.
 *   Hovering a sticker shows the team names of the players who reacted with it,
 *   and clicking one acts on it: your own sticker removes your reaction,
 *   another team's quick-reacts the same emoji for your team. Callers render
 *   this as a direct child of the card (`position: relative`), which also
 *   carries the `reaction-host` class used by the e2e specs.
 * - `ReactionAdd` — the "+" button that opens an emoji picker
 *   (emoji-picker-react) in a Popover, so the small answer cards don't carry
 *   the full picker UI. Callers render this *inside the answer box* (also
 *   `position: relative`), so it is centered on the answer itself and inset
 *   from the box's right edge — centering it on the whole card instead put it
 *   over the title row and flush against the card border.
 *
 * The API allows exactly one emoji per (answer, player): tapping the
 * highlighted chip removes the reaction, picking a different emoji changes it
 * (PUT upserts on UNIQUE(answer_id, player_id)), and picking the same emoji
 * again is treated as a remove (toggle). Each mutation bumps the session
 * state token, so the existing session_state refetch pattern propagates the
 * new counts to every client — no optimistic update needed.
 */

// PUT creates or modifies (upsert); DELETE removes. Fire-and-forget like the
// other gameplay mutations — the state-token bump drives a refetch.
// Failures are logged (and the picker still closes); the player can retry.
function remove_reaction(session_id: string, answer_id: string, player_id: string) {
    sendData("/gameplay/session/" + session_id + "/reaction", "DELETE", {answer_id, player_id})
        .catch((error) => console.error("Failed to remove reaction:", error))
}

function set_reaction(session_id: string, answer_id: string, player_id: string, emoji: string,
                      my_reaction?: string) {
    if (emoji === my_reaction) {
        remove_reaction(session_id, answer_id, player_id)
    } else {
        sendData("/gameplay/session/" + session_id + "/reaction", "PUT", {answer_id, player_id, emoji})
            .catch((error) => console.error("Failed to set reaction:", error))
    }
}

/** The "+"/picker button. Renders nothing until the answer can be reacted to. */
export function ReactionAdd({session_id, current_player, answer_id}: Props) {
    const [picker_open, set_picker_open] = React.useState(false)
    if (!answer_id) return null

    const picker = (
        <EmojiPicker width={300} height={320} emojiStyle={EmojiStyle.NATIVE}
                     previewConfig={{showPreview: false}}
                     onEmojiClick={(data) => {
                         set_reaction(session_id, answer_id, current_player, data.emoji);
                         set_picker_open(false)
                     }}/>
    )

    return (
        <div className="reaction-add">
            <Popover content={picker} trigger="click" open={picker_open}
                     onOpenChange={set_picker_open}>
                <button type="button" className="reaction-add-button" aria-label="Add reaction">+</button>
            </Popover>
        </div>
    )
}

/** The sticker strip of existing reactions. Renders nothing when there are none. */
export function ReactionStickers({session_id, current_player, answer_id, reactions, my_reaction}: Props) {
    const stickers = Object.entries(reactions || {})
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .map(([emoji, summary]) => {
            const mine = emoji === my_reaction
            // Who reacted: the team names the API aggregates per emoji.
            // Hovering the sticker reveals them (tooltip).
            const who = summary.players && summary.players.length > 0
                ? summary.players.join(', ')
                : undefined
            // Every sticker is clickable: your own removes your reaction,
            // someone else's quick-reacts the same emoji for your team (the
            // PUT upserts on UNIQUE(answer_id, player_id), so it also replaces
            // whatever you had reacted with).
            const click = !answer_id ? undefined : () => mine
                ? remove_reaction(session_id, answer_id, current_player)
                : set_reaction(session_id, answer_id, current_player, emoji)
            // The tooltip names who reacted and what the click will do.
            const action = mine ? "click to remove" : "click to react the same"
            const title = who ? who + " — " + action : action
            const chip = (
                <span key={emoji} className={"reaction-chip" + (mine ? " mine" : "")}
                      onClick={click}>
                    {emoji} {summary.count}
                </span>
            )
            return <Tooltip key={emoji} title={title}>{chip}</Tooltip>
        })

    if (stickers.length === 0) return null

    return <div className="reaction-stickers">{stickers}</div>
}
