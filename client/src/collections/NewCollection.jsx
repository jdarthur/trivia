import React, {useState} from 'react';

import {Button, Input, Modal, Typography} from 'antd';
import {useCreateCollectionMutation, useGetQuestionsQuery} from "../api/main";
import TransferQuestions from "./TransferQuestions";
import notify from "../common/notify";

export default function NewCollection(props) {

    const [name, setName] = useState("")
    const [questions, setQuestions] = useState([])

    const [create] = useCreateCollectionMutation();

    const {data: allQuestions} = useGetQuestionsQuery();

    const save = async () => {
        const body = {
            name: name,
            questions: questions,
        }

        const response = await create(body)
        if (response.error) {
            console.log(response.error)
            const desc = <div>
                <div>Unable to create collection.</div>
                Error: <Typography.Text code >{response?.error?.data?.message} </Typography.Text>
            </div>
            notify(false, desc)
        } else {
            notify(true, `Successfully created collection`)
        }

        props.close()
    }

    const disabled = !name || questions.length === 0
    const footer = <>
        <Button type="primary" onClick={save} disabled={disabled}> Create </Button>
    </>
    return (
        <Modal
            title="New Collection"
            visible={props.open}
            width={600}
            onCancel={props.close}
            footer={footer} >

            <div className="rem-question-list">
                <Input placeholder={"Collection name"} value={name} onChange={(event) => setName(event.target.value)}/>
                <TransferQuestions data={allQuestions?.questions}
                                   setQuestionIds={setQuestions}
                                   selected={questions} />
            </div>
        </Modal>
    )
}
