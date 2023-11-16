import {Popover, Select, Tooltip} from "antd";
import {InfoCircleOutlined} from "@ant-design/icons";
import React from "react";
import DeleteConfirm from "../editor/DeleteConfirm";
import {useDeleteScoringNoteMutation} from "../api/main";

export default function ScoringNoteRender(props) {
    const [deleteScoringNote] = useDeleteScoringNoteMutation()

    const deleteSelf = () => {
        props.onScoringDelete(props.id)
        deleteScoringNote(props.id)
    }

    const content = <div style={{maxWidth: 200}}>{props.description}</div>

    const title = <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <span>{props.name}</span>
        <DeleteConfirm delete={deleteSelf} style={{cursor: "pointer"}}/>
    </span>

    return <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <span>{props.name}</span>
        <Popover title={title} content={content} zIndex={99999} placement={"right"}>
            <InfoCircleOutlined/>
        </Popover>
    </span>
}