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

    useEffect(() => {
        console.log("set selected: ", props.selected)
        setCategory(props.selected?.category || "")
        setQuestion(props.selected?.question || "")
        setAnswer(props.selected?.answer || "")

    }, [props.selected])

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
            answer: answer
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
                           visible={props.visible}/>
    );
}
