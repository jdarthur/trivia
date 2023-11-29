import {Popover} from "antd";
import {InfoCircleOutlined} from "@ant-design/icons";
import React from "react";
import DeleteConfirm from "../editor/DeleteConfirm";
import {useDeleteScoringNoteMutation} from "../api/main";

export default function ScoringNoteRender({id, name, onScoringDelete, description,}) {
    const [deleteScoringNote] = useDeleteScoringNoteMutation()

    const deleteSelf = () => {
        onScoringDelete(id)
        deleteScoringNote(id)
    }

    const content = <div style={{maxWidth: 200}}>{description}</div>

    const title = <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <span>{name}</span>
        <DeleteConfirm delete={deleteSelf} style={{cursor: "pointer"}}/>
    </span>

    return <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <span>{name}</span>
        <Popover title={title} content={content} zIndex={99999} placement={"right"}>
            <InfoCircleOutlined/>
        </Popover>
    </span>
}