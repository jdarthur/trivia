import React from 'react';
import { Button } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

interface Props {
    // The items in their current (player-chosen) order.
    items: string[]
    // Called with the next order after a move; the caller owns the state.
    onChange: (order: string[]) => void
}

// Ticket #214: the player-side answer grid for `ordering` questions — a
// single-pane list, visually like one side of an antd <Transfer />, where each
// row's up/down buttons swap it with its neighbor. The row's position IS the
// answer: build_answer JSON-serializes the final order.
export default function OrderedAnswerList(props: Props) {
    const swap = (index: number, direction: -1 | 1) => {
        const next = [...props.items]
        const target = index + direction
        ;[next[index], next[target]] = [next[target], next[index]]
        props.onChange(next)
    }

    return (
        <div className="ordered-answer-list">
            {props.items.map((item, index) => (
                <div key={item} className="ordered-answer-row">
                    <span className="ordered-answer-text">{item}</span>
                    <span className="ordered-answer-controls">
                        <Button size="small" icon={<ArrowUpOutlined/>}
                                disabled={index === 0}
                                onClick={() => swap(index, -1)}
                                aria-label={`Move ${item} up`}/>
                        <Button size="small" icon={<ArrowDownOutlined/>}
                                disabled={index === props.items.length - 1}
                                onClick={() => swap(index, 1)}
                                aria-label={`Move ${item} down`}/>
                    </span>
                </div>
            ))}
        </div>
    )
}
