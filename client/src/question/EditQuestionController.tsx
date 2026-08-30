import React, {useEffect, useState} from 'react';
import './Question.css';

import {Button} from 'antd';
import EditQuestionModal, {STEP_COUNT, STEP_EDITOR} from "./EditQuestionModal";
import {useCreateQuestionMutation, useDeleteQuestionMutation, useUpdateQuestionMutation} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import type {Question, QuestionBucket, QuestionBucketItem, QuestionChoice, QuestionOrderedItem, QuestionPair} from "../types/models";

export const CATEGORY = "category"
export const QUESTION = "question"
export const ANSWER = "answer"

interface Props {
    selected: Partial<Question>
    visible: boolean
    delete?: (() => void) | null
    close: () => void
}

export default function EditQuestionController(props: Props) {

    const [category, setCategory] = useState("")
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [question_type, setQuestionType] = useState("freeform")
    const [choices, setChoices] = useState<QuestionChoice[]>([])
    const [pairs, setPairs] = useState<QuestionPair[]>([])
    const [buckets, setBuckets] = useState<QuestionBucket[]>([])
    const [items, setItems] = useState<QuestionBucketItem[]>([])
    const [ordered, setOrdered] = useState<QuestionOrderedItem[]>([])
    // Ticket #166: the current step of the multi-step question editor.
    const [step, setStep] = useState(0)
    // Set when Next is attempted on the Question step so the validation error
    // can be shown; the message itself is derived so it clears the moment the
    // question becomes valid (e.g. a correct answer is selected).
    const [nextAttempted, setNextAttempted] = useState(false)

    useEffect(() => {
        console.log("useEffect: ", props.selected)
        setCategory(props.selected?.category || "")
        setQuestion(props.selected?.question || "")
        setAnswer(props.selected?.answer || "")
        setQuestionType(props.selected?.question_type || "freeform")
        setChoices(props.selected?.choices || [])
        setPairs(props.selected?.pairs || [])
        setBuckets(props.selected?.buckets || [])
        setItems(props.selected?.items || [])
        setOrdered(props.selected?.ordered || [])
        // Ticket #166: a new question starts at the first step; an existing
        // one opens on the Question step, since editing usually means changing
        // the question text rather than the type/category info.
        setStep(props.selected?.id ? STEP_EDITOR : 0)
        setNextAttempted(false)
    }, [props.selected])

    const [createQuestion] = useCreateQuestionMutation()
    const [updateQuestion] = useUpdateQuestionMutation()
    const [deleteQuestion] = useDeleteQuestionMutation()

    const id = props.selected?.id

    const delete_self = async () => {
        const response = await deleteQuestion(id as string)
        if (response.error) {
            const desc = errorMessage("delete", "question", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted question`)
        }
        props.close()
    }

    const save_self = async () => {
        const body = {
            category: category,
            question: question,
            answer: question_type === "freeform" ? answer : "",
            question_type: question_type,
            choices: choices,
            pairs: pairs,
            buckets: buckets,
            items: items,
            ordered: ordered
        }

        const response = !!id
            ? await updateQuestion({id: id, body: body})
            : await createQuestion(body)

        if (response.error) {
            const desc = errorMessage(!id ? "create" : "update", "question", response.error)
            notify(false, desc)
        } else {
            const verb = !id ? "created" : "updated"
            notify(true, `Successfully ${verb} question`)
        }

        console.log("save question", body)
        props.close()
    }

    const is_empty = () => {
        return category === "" && question === "" && answer === ""
    }

    // Ticket #166: validate the Question step before advancing to Preview. A
    // multiple-choice question must have a correct answer selected, otherwise
    // the server rejects the save with no UI feedback. Returns the error to
    // show (empty string when the step is valid).
    const editor_step_error = () => {
        if (question_type === "multiple_choice" &&
            !choices.some(choice => choice.is_correct)) {
            return "Please select a correct answer"
        }
        // Ticket #213: the server requires at least two ordered items.
        if (question_type === "ordering" && ordered.length < 2) {
            return "Please add at least two ordered items"
        }
        return ""
    }

    // Only surface the error once Next has been attempted, so it appears after
    // the user tries to proceed and clears as soon as the question is valid.
    const step_error = nextAttempted && step === STEP_EDITOR ? editor_step_error() : ""

    const next_step = () => {
        if (step === STEP_EDITOR) {
            setNextAttempted(true)
            if (editor_step_error() !== "") {
                return
            }
        }
        setStep(step + 1)
    }

    const title = !id ? "Add question" : "Edit question"
    const save_text = !id ? "Add" : "Update"
    const cancel_action = is_empty() ? props.close : save_self

    // Ticket #166: step-aware footer. The Submit button only appears on the
    // last step of the <Steps /> flow; Back/Next navigate between steps. Delete
    // stays available wherever the question already exists.
    const lastStep = STEP_COUNT - 1
    const backButton = step > 0 ?
        <Button className="button" onClick={() => setStep(step - 1)}> Back </Button> : null
    const nextButton = step < lastStep ?
        <Button className="button" type="primary" onClick={next_step}> Next </Button> : null
    const submitButton = step === lastStep ?
        <Button className="button" type="primary" onClick={save_self}> {save_text} </Button> : null
    const deleteButton = id ?
        <Button danger className="button" onClick={delete_self}> Delete</Button> : null

    const footer = <div className="save-delete">
        <div style={{display: "flex"}}>
            {backButton}
            {deleteButton}
        </div>
        <div style={{display: "flex"}}>
            {nextButton}
            {submitButton}
        </div>
    </div>


    return (
        <EditQuestionModal title={title} cancel={cancel_action}
                           save_text={save_text} save={save_self}
                           initialValues={props.selected} footer={footer}
                           set_category={setCategory} category={category}
                           set_question={setQuestion} question={question}
                           set_answer={setAnswer} answer={answer}
                           question_type={question_type} set_question_type={setQuestionType}
                           choices={choices} set_choices={setChoices}
                           pairs={pairs} set_pairs={setPairs}
                           buckets={buckets} set_buckets={setBuckets}
                           items={items} set_items={setItems}
                           ordered={ordered} set_ordered={setOrdered}
                           steps step={step} step_error={step_error}
                           visible={props.visible}/>
    );
}
