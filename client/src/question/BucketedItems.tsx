import React from 'react';

import {Tag} from 'antd';

// Tag background colors, one per bucket via a stable hash so the same bucket
// always gets the same color across re-renders (no flicker). All are dark
// shades (antd level-7/8, relative luminance ≤ ~0.14 — well under 50%
// brightness) so white tag text stays readable: antd renders white text for a
// custom hex color on the "solid" variant, and every color here keeps ≥5.4:1
// contrast against it. Gold/lime use their darker level-8 shade to clear the
// 4.5:1 bar.
const TAG_COLORS = [
    "#a8071a", // red
    "#ad2e24", // volcano
    "#ad4e00", // orange
    "#874d00", // gold
    "#3f6600", // lime
    "#237804", // green
    "#006d75", // cyan
    "#0050b3", // blue
    "#10239e", // geekblue
    "#391085", // purple
    "#9e1068", // magenta
]

export function bucketColor(bucket: string): string {
    let hash = 0
    for (let i = 0; i < bucket.length; i++) {
        hash = (hash * 31 + bucket.charCodeAt(i)) >>> 0
    }
    return TAG_COLORS[hash % TAG_COLORS.length]
}

interface Props {
    items: {text: string, bucket: string}[]
}

/**
 * The bucketing answer key: each item tagged with the bucket it belongs to,
 * colorized per bucket. Shared by the editor's Preview "Show answer" view
 * (QuestionBody) and the in-game mod question box once the question is scored
 * (ActiveQuestion), so the two views can't drift.
 */
export default function BucketedItems(props: Props) {
    return (
        <ul style={{marginTop: 10, paddingLeft: 18}}>
            {(props.items || []).map((item, index) => (
                <li key={index} style={{marginBottom: 4}}>
                    {item.text}{" "}
                    {item.bucket ?
                        // variant="solid" (antd v6): a custom hex color on the
                        // default "filled" variant is lightened to 95% lightness
                        // with the text in the original color; solid keeps the
                        // dark background with white text.
                        <Tag color={bucketColor(item.bucket)} variant="solid">{item.bucket}</Tag> :
                        <Tag>Unassigned</Tag>}
                </li>
            ))}
        </ul>
    );
}
