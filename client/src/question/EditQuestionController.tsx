import React, {useEffect, useState} from 'react';
import './Question.css';

import {Button} from 'antd';
import EditQuestionModal from "./EditQuestionModal";
import {useCreateQuestionMutation, useDeleteQuestionMutation, useUpdateQuestionMutation} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import type {Question, QuestionChoice, QuestionPair} from "../types/models";

export const CATEGORY = "category"
export const QUESTION = "question"
export const ANSWER = "answer"

interface Props {
    selected: Partial<Question>
    visible: boolean
    delete?: (() => void) | null
    close: () => void
    scoringNoteWasCleared: boolean
    setScoringNoteWasCleared: (value: boolean) => void
}

export default function EditQuestionController(props: Props) {

    const [category, setCategory] = useState("")
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [scoringNote, setScoringNote] = useState("")
    const [question_type, setQuestionType] = useState("freeform")
    const [choices, setChoices] = useState<QuestionChoice[]>([])
    const [pairs, setPairs] = useState<QuestionPair[]>([])

    useEffect(() => {
        console.log("useEffect: ", props.selected)
        setCategory(props.selected?.category || "")
        setQuestion(props.selected?.question || "")
        setAnswer(props.selected?.answer || "")
        setQuestionType(props.selected?.question_type || "freeform")
        setChoices(props.selected?.choices || [])
        setPairs(props.selected?.pairs || [])

        if (props.scoringNoteWasCleared === false) {
            setScoringNote(props.selected?.scoring_note || "")
        } else {
            setScoringNote("")
        }
    }, [props.selected, props.scoringNoteWasCleared])

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
            scoring_note: scoringNote,
            question_type: question_type,
            choices: choices,
            pairs: pairs
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
        props.setScoringNoteWasCleared(false)
    }

    const is_empty = () => {
        return category === "" && question === "" && answer === ""
    }

    const title = !id ? "Add question" : "Edit question"
    const save_text = !id ? "Add" : "Update"
    const cancel_action = is_empty() ? props.close : save_self

    const footer = <div className="save-delete">
        <Button danger className="button" onClick={delete_self}> Delete</Button>
        <Button className="button" type="primary" onClick={save_self}> {save_text} </Button>
    </div>


    return (
        <EditQuestionModal title={title} cancel={cancel_action}
                           save_text={save_text} save={save_self}
                           initialValues={props.selected} footer={footer}
                           set_category={setCategory} category={category}
                           set_question={setQuestion} question={question}
                           set_answer={setAnswer} answer={answer}
                           set_scoring_note={setScoringNote} scoring_note={scoringNote}
                           set_scoring_note_was_cleared={props.setScoringNoteWasCleared}
                           question_type={question_type} set_question_type={setQuestionType}
                           choices={choices} set_choices={setChoices}
                           pairs={pairs} set_pairs={setPairs}
                           visible={props.visible}/>
    );
}
