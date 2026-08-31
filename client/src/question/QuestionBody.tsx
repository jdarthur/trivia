import React from 'react';

import FormattedQuestion from "./FormattedQuestion";
import BucketedItems from "./BucketedItems";
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
                    <BucketedItems items={props.items || []}/>
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
