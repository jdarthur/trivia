import {Popover, Tooltip} from "antd";
import {InfoCircleOutlined} from "@ant-design/icons";
import React from "react";
import DeleteConfirm from "../editor/DeleteConfirm";
import {useDeleteScoringNoteMutation, useGetOneScoringNoteQuery, useGetScoringNotesQuery} from "../api/main";

export default function ScoringNoteRenderInList({id}) {
    const {data} = useGetOneScoringNoteQuery(id)

    console.log(id)

    const content = <div style={{maxWidth: 200}}>{data?.description}</div>

    return <Tooltip title={content} placement={"right"}>
        <InfoCircleOutlined style={{marginLeft: "0.5em"}}/>
    </Tooltip>
}