import React, {useEffect, useState} from 'react';
import '../question/Question.css';
import './OpenRound.css';

import {Button, Input, Modal, Steps} from 'antd';
import TransferQuestions from "../collections/TransferQuestions";
import Incrementer from "./Incrementer";
import {
    useAllQuestions,
    useCreateRoundMutation,
    useDeleteRoundMutation,
    useUpdateRoundMutation,
} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import type {Round} from "../types/models";

// Ticket #199: the round editor is a single modal with multiple steps, a la the
// question editor's <Steps/> flow (ticket #166). Step 1 edits the round's name
// and wagers; step 2 picks its questions with a <Transfer/>. The old sidebar
// editor (OpenRound) is replaced by this modal opened from the rounds table.
const STEP_DETAILS = 0
const STEP_QUESTIONS = 1
const STEP_COUNT = 2

interface Props {
    visible: boolean
    setVisible: (visible: boolean) => void
    round: Round | null
}

export default function RoundModal(props: Props) {
    const [name, setName] = useState("")
    const [wagers, setWagers] = useState<number[]>([])
    const [questions, setQuestions] = useState<string[]>([])
    const [step, setStep] = useState(STEP_DETAILS)

    const {data: allQuestions} = useAllQuestions()

    // (Re)initialize the form whenever the modal opens — from scratch for a new
    // round, or from the round being edited. Always start on the Details step.
    useEffect(() => {
        if (props.visible) {
            setName(props.round?.name || "")
            setWagers(props.round?.wagers || [])
            setQuestions(props.round?.questions || [])
            setStep(STEP_DETAILS)
        }
    }, [props.visible, props.round])

    const [createRound] = useCreateRoundMutation()
    const [updateRound] = useUpdateRoundMutation()
    const [deleteRound] = useDeleteRoundMutation()

    const id = props.round?.id

    const close = () => props.setVisible(false)

    const save_self = async () => {
        const body = {name, questions, wagers}
        const response = id
            ? await updateRound({id, body})
            : await createRound(body)

        if (response.error) {
            const desc = errorMessage(!id ? "create" : "update", "round", response.error)
            notify(false, desc)
        } else {
            const verb = !id ? "created" : "updated"
            notify(true, `Successfully ${verb} round`)
            close()
        }
    }

    const delete_self = async () => {
        if (!id) {
            return
        }
        const response = await deleteRound(id)
        if (response.error) {
            const desc = errorMessage("delete", "round", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted round`)
        }
        close()
    }

    const set_wager = (index: number, value: number) => {
        const next = [...wagers]
        next[index] = value
        setWagers(next)
    }

    // Wagers are parallel to the questions (the server enforces one wager per
    // question), so keep them aligned as questions move across the Transfer: a
    // question that stays keeps its wager, a newly added one gets a default.
    const onQuestionsChange = (newQuestionIds: string[]) => {
        const newWagers = newQuestionIds.map((questionId, index) => {
            const oldIndex = questions.indexOf(questionId)
            if (oldIndex !== -1) {
                return wagers[oldIndex]
            }
            return (index % 3) + 1
        })
        setQuestions(newQuestionIds)
        setWagers(newWagers)
    }

    const lastStep = STEP_COUNT - 1
    const backButton = step > 0 ?
        <Button className="button" onClick={() => setStep(step - 1)}> Back </Button> : null
    const nextButton = step < lastStep ?
        <Button className="button" type="primary" onClick={() => setStep(step + 1)}> Next </Button> : null
    const submitButton = step === lastStep ?
        <Button className="button" type="primary" onClick={save_self}> {id ? "Update" : "Add"} </Button> : null
    const deleteButton = id ?
        <Button danger className="button" onClick={delete_self}> Delete </Button> : null

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

    const wager_inputs = wagers.map((wager, index) => (
        <Incrementer key={index} index={index} value={wager} set={set_wager}/>
    ))

    const detailsStep = <div>
        <div style={{fontWeight: 600, marginBottom: 4}}>Round name</div>
        <Input className="round-name" placeholder="Round name" value={name}
               onChange={(event) => setName(event.target.value)}/>
        <div style={{fontWeight: 600, marginBottom: 4, marginTop: 14}}>Wagers</div>
        {wagers.length > 0 ? wager_inputs :
            <div style={{color: "#8c8c8c"}}>
                No questions yet — wagers appear once you add questions on the next step.
            </div>}
    </div>

    const questionsStep = <TransferQuestions data={allQuestions} selected={questions}
                                             setQuestionIds={onQuestionsChange}/>

    const body = <div style={{display: "flex", flexDirection: "column"}}>
        <Steps size="small" current={step} style={{marginBottom: 20}}
               items={[{title: "Details"}, {title: "Questions"}]}/>
        {step === STEP_DETAILS ? detailsStep : questionsStep}
    </div>

    return (
        <Modal open={props.visible} title={id ? "Edit round" : "Add round"}
               onCancel={close} footer={footer} width="620px">
            {body}
        </Modal>
    );
}
