import React from 'react';

import {Tag} from 'antd';
import FormattedQuestion from "./FormattedQuestion";
import type {QuestionBucket, QuestionBucketItem, QuestionChoice, QuestionOrderedItem, QuestionPair} from "../types/models";

interface Props {
    question: string
    answer?: string
    question_type?: string
    choices?: QuestionChoice[]
    pairs?: QuestionPair[]
    buckets?: QuestionBucket[]
    items?: QuestionBucketItem[]
    ordered?: QuestionOrderedItem[]
    max_width?: number
    // Graded rendering mirroring the in-game question box after scoring: the
    // multiple-choice option list marks the correct choice (✅ + bold) and the
    // standalone answer line is hidden for multiple choice (it would duplicate
    // the marked option, ticket #160). For bucketing, the items render tagged
    // with the bucket they belong to (the answer key); matching and ordering
    // lists themselves are the answer key, so they render unchanged.
    scored?: boolean
    // Whether to render the standalone answer line. Only freeform questions
    // carry answer text (structured types store it in their lists), so this
    // only affects freeform questions.
    show_answer?: boolean
}

// Tag background colors, one per bucket via a stable hash so the same bucket
// always gets the same color across re-renders (no flicker). All are dark
// shades (antd level-7/8, relative luminance ≤ ~0.14 — well under 50%
// brightness) so white tag text stays readable: antd renders white text when
// a custom hex color is passed, and every color here keeps ≥5.4:1 contrast
// against it. Gold/lime use their darker level-8 shade to clear the bar.
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

function bucketColor(bucket: string): string {
    let hash = 0
    for (let i = 0; i < bucket.length; i++) {
        hash = (hash * 31 + bucket.charCodeAt(i)) >>> 0
    }
    return TAG_COLORS[hash % TAG_COLORS.length]
}

/**
 * The shared "how a question looks" body used by the editor's read-only
 * question cards and by the question editor's Preview step — so an admin can
 * preview exactly what a question will look like in-game.
 */
export default function QuestionBody(props: Props) {

    const mcScored = props.scored && props.question_type === "multiple_choice"
    const answerVisible = props.show_answer && !mcScored
        && (!props.question_type || props.question_type === "freeform")

    return (
        <div>
            <FormattedQuestion question={props.question}
                               answer={answerVisible ? props.answer : ""}
                               max_width={props.max_width}
                               scored={props.scored && answerVisible}/>
            {props.question_type === "multiple_choice" && (props.choices || []).length > 0 ?
                <ol style={{marginTop: 10, paddingLeft: 20}}>
                    {(props.choices || []).map((choice, index) => {
                        const isCorrect = props.scored && choice.is_correct
                        return <li key={index} style={isCorrect ? {fontWeight: "bold"} : undefined}>
                            {props.scored ? (isCorrect ? "✅ " : "❌ ") : null}{choice.text}
                        </li>
                    })}
                </ol> : null}
            {props.question_type === "matching" && (props.pairs || []).length > 0 ?
                <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                    <tbody>
                        <tr>
                            <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                <ul style={{margin: 0, paddingLeft: 18}}>
                                    {(props.pairs || []).map((pair, index) => <li key={index}>{pair.left}</li>)}
                                </ul>
                            </td>
                            <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                <ul style={{margin: 0, paddingLeft: 18}}>
                                    {(props.pairs || []).map((pair, index) => <li key={index}>{pair.right}</li>)}
                                </ul>
                            </td>
                        </tr>
                    </tbody>
                </table> : null}
            {props.question_type === "bucketing" && (props.items || []).length > 0 ?
                props.scored ? (
                    // The answer key: each item tagged with the bucket it
                    // belongs to, colorized per bucket so the grouping is
                    // visible at a glance.
                    <ul style={{marginTop: 10, paddingLeft: 18}}>
                        {(props.items || []).map((item, index) => (
                            <li key={index} style={{marginBottom: 4}}>
                                {item.text}{" "}
                                {item.bucket ?
                                    // variant="solid" (antd v6): a custom hex
                                    // color on the default "filled" variant is
                                    // lightened to 95% lightness with the text
                                    // in the original color; solid keeps the
                                    // dark background with white text.
                                    <Tag color={bucketColor(item.bucket)} variant="solid">{item.bucket}</Tag> :
                                    <Tag>Unassigned</Tag>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                        <tbody>
                            <tr>
                                <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                    <ul style={{margin: 0, paddingLeft: 18}}>
                                        {(props.items || []).map((item, index) => <li key={index}>{item.text}</li>)}
                                    </ul>
                                </td>
                                <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                    <ul style={{margin: 0, paddingLeft: 18}}>
                                        {(props.buckets || []).map((bucket, index) => <li key={index}>{bucket.text}</li>)}
                                    </ul>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : null}
            {props.question_type === "ordering" && (props.ordered || []).length > 0 ?
                <ol style={{marginTop: 10, paddingLeft: 20}}>
                    {(props.ordered || []).map((item, index) => <li key={index}>{item.text}</li>)}
                </ol> : null}
        </div>
    );
}
