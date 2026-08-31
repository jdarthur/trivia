import React from 'react';

import FormattedQuestion from "./FormattedQuestion";
import {hashSeed, seededShuffle} from "../common/shuffle";
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
    // the marked option, ticket #160). Matching and bucketing lists themselves
    // are the answer key, so they render unchanged; ordering renders its
    // numbered answer key (1..n) — or a scrambled bullet list via
    // scramble_ordered.
    scored?: boolean
    // Whether to render the standalone answer line. Only freeform questions
    // carry answer text (structured types store it in their lists), so this
    // only affects freeform questions.
    show_answer?: boolean
    // Ordering (ticket #213): when set, the items render as a bullet list in
    // a deterministic scrambled order — mirroring the shuffled list players
    // see in-game pre-score (ticket #211/#215) — instead of the canonical
    // numbered answer key. Used by the editor's Preview step before "Show
    // answer"; the read-only question cards show the answer key, so they
    // leave this off.
    scramble_ordered?: boolean
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
                </table> : null}
            {props.question_type === "ordering" && (props.ordered || []).length > 0 ?
                props.scramble_ordered ? (
                    // The pre-answer preview: a bullet list in a deterministic
                    // scrambled order (same shuffle the mod's in-game question
                    // box uses, ticket #215) — seeded from the question's own
                    // content so the preview is stable across re-renders.
                    <ul style={{marginTop: 10, paddingLeft: 20}}>
                        {seededShuffle((props.ordered || []).map(item => item.text),
                                       hashSeed(props.question, ...(props.ordered || []).map(item => item.text)))
                            .map((text, index) => <li key={index}>{text}</li>)}
                    </ul>
                ) : (
                    // The answer key: the canonical order, numbered 1..n.
                    <ol style={{marginTop: 10, paddingLeft: 20}}>
                        {(props.ordered || []).map((item, index) => <li key={index}>{item.text}</li>)}
                    </ol>
                ) : null}
        </div>
    );
}
