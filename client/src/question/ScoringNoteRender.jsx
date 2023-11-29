import {Popover} from "antd";
import {InfoCircleOutlined} from "@ant-design/icons";
import React from "react";
import DeleteConfirm from "../editor/DeleteConfirm";
import {useDeleteScoringNoteMutation} from "../api/main";
import ShortTextWithPopover from "../common/ShortTextWithPopover";

export default function ScoringNoteRender({id, name, onScoringDelete, description,}) {
    const [deleteScoringNote] = useDeleteScoringNoteMutation()

    const deleteSelf = () => {
        onScoringDelete(id)
        deleteScoringNote(id)
    }

    const content = <div style={{maxWidth: 200}}>{description}</div>

    let shortName = name
    if (name?.length > 8) {
        shortName = name.substring(0, 8) + "..."
    }

    console.log(name, ",", shortName)

    const title = <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <ShortTextWithPopover text={name} maxLength={20}/>
        <DeleteConfirm delete={deleteSelf} style={{cursor: "pointer"}}/>
    </span>

    return <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <ShortTextWithPopover text={name} maxLength={8}/>
        <Popover title={title} content={content} zIndex={99999} placement={"right"}>
            <InfoCircleOutlined/>
        </Popover>
    </span>
}