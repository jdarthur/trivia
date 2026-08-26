import React, {useEffect, useState} from 'react';
import '../question/Question.css';

import {Button} from 'antd';
import EditQuestionModal from "../question/EditQuestionModal";
import {useGetCategoriesQuery} from "../api/main";
import type {QuestionBucket, QuestionBucketItem, QuestionPair} from "../types/models";

interface Props {
    // The snapshot carries the category NAME (resolved server-side); the
    // selector maps it back to the category ID for the save payload.
    category: string
    question: string
    answer: string
    close: () => void
    session_id: string
    player_id: string
    round_index: number | string
    question_index: number | string
    question_type?: string
    choices?: string[]
    pairs?: QuestionPair[]
    buckets?: QuestionBucket[]
    items?: QuestionBucketItem[]
}

export default function HotEditQuestion(props: Props) {

    const {data: categories} = useGetCategoriesQuery()

    // The question stores the category ID now (ticket #180), but the session
    // snapshot only carries the resolved name. Find the category that name
    // belongs to once the user's categories load; fall back to "" (no
    // category) if it no longer exists. `touched` stops the sync from
    // overriding a selection the user already made.
    const [category, setCategory] = useState("")
    const [touched, setTouched] = useState(false)

    useEffect(() => {
        if (!touched && props.category) {
            const match = (categories || []).find(c => c.name === props.category)
            if (match) {
                setCategory(match.id)
            }
        }
    }, [categories, props.category, touched])

    const selectCategory = (value: string) => {
        setTouched(true)
        setCategory(value)
    }

    const [question, setQuestion] = useState(props.question)
    const [answer, setAnswer] = useState(props.answer)
    const [saving, setSaving] = useState(false)

    const structured = () => {
        return props.question_type === "multiple_choice"
            || props.question_type === "matching"
            || props.question_type === "bucketing"
    }

    const save_self = async () => {
        if (saving) {
            return
        }
        console.log("save")

        // The scoring note is no longer sent (ticket #180): it rides on the
        // category, which the server re-resolves on save.
        const questionData = {
            round_index: props.round_index,
            question_index: props.question_index,
            question: {
                category: category,
                question: question,
                answer: structured() ? props.answer : answer,
                question_type: props.question_type
            }
        }

        // Guard double-clicks on Update (ticket #147).
        setSaving(true)
        save(props.session_id, props.player_id, questionData)
            .then(() => {
                props.close()
            })
            .catch((error: any) => {
                console.log(error)
            })
            .finally(() => {
                setSaving(false)
            })
    }

    const disabled = () => {
        if (saving) {
            return true
        }
        if (structured()) {
            return category === "" || question === ""
        }
        return category === "" || question === "" || answer === ""
    }

    const footer = <div className="save-delete">
        <Button className="button" type="primary" disabled={disabled()}
                onClick={save_self}> Update </Button>
    </div>

    return (
        <EditQuestionModal title="Edit Question" cancel={props.close}
                           save_text="Update" save_action={save_self}
                           question={question} answer={answer}
                           category={category} footer={footer}
                           set_question={setQuestion}
                           set_category={selectCategory}
                           set_answer={setAnswer}
                           question_type={props.question_type}
                           choices={(props.choices || []).map((text, index) => ({
                               text: text, is_correct: false
                           }))}
                           pairs={props.pairs}
                           buckets={props.buckets}
                           items={props.items}
                           disabled={structured()}
                           visible={true}/>
    );
}

async function save(session_id: string, player_id: string, question_data: any): Promise<any> {
    const url = "/gameplay/session/" + session_id + "/hot-edit-question?player_id=" + player_id
    const response = await fetch(url, {
        method: "PUT",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(question_data)
    })
    return response.json()
}
