import React, {useState} from "react";
import {Button, Select} from "antd";
import {useGetScoringNotesQuery} from "../api/main";

import {PlusSquareOutlined} from '@ant-design/icons';
import CreateScoringNote from "./CreateScoringNote";
import ScoringNoteRender from "./ScoringNoteRender";

export default function ScoringNote(props) {

    const [showNewNoteModal, setShowNewNoteModal] = useState(false)

    const {data} = useGetScoringNotesQuery(undefined, undefined)

    const options = [
        <Select.Option value={""} label={"None"} key={"none"}>
            <span>None</span>
        </Select.Option>
    ]

    const onDeleteScoringNote = (noteId) => {
        console.log("note ID: ", noteId, props.scoring_note)
        if (noteId === props.scoring_note) {
            console.log("ok")
            props.set_scoring_note_was_cleared(true)
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

    const newButton = (menu) => {
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
            <Select style={{marginLeft: 5, width: 125}} value={[props.scoring_note]}
                    onSelect={props.set_scoring_note}
                    dropdownRender={menu => newButton(menu)}>

                {options}
            </Select>

        </span>
    )
}

