import React, {useEffect, useState} from 'react';
import './Question.css';

import {Button} from 'antd';
import EditQuestionModal from "./EditQuestionModal";
import {useCreateQuestionMutation, useDeleteQuestionMutation, useUpdateQuestionMutation} from "../api/main";
import notify, {errorMessage} from "../common/notify";

export const CATEGORY = "category"
export const QUESTION = "question"
export const ANSWER = "answer"

export default function EditQuestionController(props) {

    const [category, setCategory] = useState("")
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [scoringNote, setScoringNote] = useState("")

    useEffect(() => {
        console.log("useEffect: ", props.selected)
        setCategory(props.selected?.category || "")
        setQuestion(props.selected?.question || "")
        setAnswer(props.selected?.answer || "")

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
        const response = await deleteQuestion(id)
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
            answer: answer,
            scoring_note: scoringNote
        }

        const response = !!id ? await updateQuestion({id: props.selected?.id, body: body}) : createQuestion(body)

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
                           visible={props.visible}/>
    );
}
