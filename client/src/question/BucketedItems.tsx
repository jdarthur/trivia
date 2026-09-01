import React from 'react';

import {Tag} from 'antd';

import {bucketColor} from '../common/colors';

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
