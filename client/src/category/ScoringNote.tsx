import React, {useState} from "react";
import {Button, Select} from "antd";
import {useGetScoringNotesQuery} from "../api/main";

import {PlusSquareOutlined} from '@ant-design/icons';
import CreateScoringNote from "./CreateScoringNote";
import ScoringNoteRender from "./ScoringNoteRender";

interface Props {
    scoring_note: string
    set_scoring_note: (value: string) => void
}

export default function ScoringNote(props: Props) {

    const [showNewNoteModal, setShowNewNoteModal] = useState(false)

    const {data} = useGetScoringNotesQuery(undefined, undefined)

    const options = [
        <Select.Option value={""} label={"None"} key={"none"}>
            <span>None</span>
        </Select.Option>
    ]

    // The note rides on the category now (ticket #180): if the note selected
    // here is deleted, clear the selection rather than keep a dangling ID.
    const onDeleteScoringNote = (noteId: string) => {
        if (noteId === props.scoring_note) {
            props.set_scoring_note("")
        }
    }

    data?.forEach((item) => {
        //console.log(item)
        options.push(<Select.Option value={item.id} label={item.name}>
            <ScoringNoteRender key={item.id}
                               id={item.id}
                               name={item.name}
                               description={item.description}
                               onScoringDelete={onDeleteScoringNote}
            />
        </Select.Option>)
    })

    const newNoteModal = <CreateScoringNote visible={showNewNoteModal} setVisible={setShowNewNoteModal}/>

    const newButton = (menu: React.ReactNode) => {
        return <>
            {menu}
            <Button title={"New"}
                    onClick={() => setShowNewNoteModal(true)}
                    style={{width: 100, margin: "5px 12px 5px 12px"}}
            >
                <PlusSquareOutlined/>
                New
            </Button>
        </>
    }

    return (
        <span style={{display: "flex", alignItems: "center"}}>
            {newNoteModal}
            <span style={{marginLeft: 10}}>Note: </span>
            <Select style={{marginLeft: 5, width: 125}} value={props.scoring_note}
                    onSelect={props.set_scoring_note}
                    dropdownRender={menu => newButton(menu)}>

                {options}
            </Select>

        </span>
    )
}
