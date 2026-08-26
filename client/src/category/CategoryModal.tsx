import React, {useEffect, useState} from 'react';
import {Button, Input, Modal, Typography} from "antd";
import {useCreateCategoryMutation, useUpdateCategoryMutation} from "../api/main";
import ScoringNote from "./ScoringNote";
import notify from "../common/notify";
import type {Category} from "../types/models";

interface Props {
    visible: boolean
    setVisible: (value: boolean) => void
    // When set, the modal edits that category; otherwise it creates a new one.
    category?: Category | null
}

/**
 * Create/edit modal for a category (ticket #180): a required name plus the
 * optional associated scoring note (D2 — the note moved off the question).
 */
export default function CategoryModal(props: Props) {

    const [name, setName] = useState("")
    const [scoringNote, setScoringNote] = useState("")

    const [create] = useCreateCategoryMutation()
    const [update] = useUpdateCategoryMutation()

    // (Re)initialize the form whenever the modal opens, from the category
    // being edited (empty for a new category).
    useEffect(() => {
        if (props.visible) {
            setName(props.category?.name || "")
            setScoringNote(props.category?.scoring_note || "")
        }
    }, [props.visible, props.category])

    const save = async () => {
        const body = {name: name, scoring_note: scoringNote}
        const response = props.category
            ? await update({id: props.category.id, body: body})
            : await create(body)
        if (response.error) {
            const desc = <div>
                <div>Unable to {props.category ? "update" : "create"} category.</div>
                Error: <Typography.Text code >{(response.error as { data?: { message?: string } }).data?.message} </Typography.Text>
            </div>
            notify(false, desc)
        } else {
            notify(true, `Successfully ${props.category ? "updated" : "created"} category`)
        }
        props.setVisible(false)
    }

    const footer = <>
        <Button type="primary" onClick={save} disabled={!name}>
            {props.category ? "Update" : "Create"}
        </Button>
    </>

    return (
        <Modal
            title={props.category ? "Edit category" : "New category"}
            open={props.visible}
            onCancel={() => props.setVisible(false)}
            footer={footer}
            width="350px"
        >
            <span style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10}}>
                <span style={{marginRight: 10}}>Name:</span>
                <Input placeholder={"Name"} value={name}
                       onChange={(event) => setName(event.target.value)}
                       style={{width: 200}}/>
            </span>
            <ScoringNote scoring_note={scoringNote} set_scoring_note={setScoringNote}/>
        </Modal>
    )
}
