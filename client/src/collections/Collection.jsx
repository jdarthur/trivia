import React from 'react';
import {Card, Typography} from 'antd';
import {useDeleteCollectionMutation} from "../api/main";
import notify from "../common/notify";
import DeleteConfirm from "../editor/DeleteConfirm";

import {
    ShareAltOutlined
} from '@ant-design/icons';

const INVITE_LINK = "inviteLink"

export default function Collection(props) {

    const [deleteCollection] = useDeleteCollectionMutation()

    const deleteSelf = async () => {
        const response = await deleteCollection(props.id)
        if (response.error) {
            const desc = <div>
                <div>Unable to delete collection.</div>
                Error: <Typography.Text code >{response?.error?.data?.message} </Typography.Text>
            </div>
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted collection`)
        }
    }

    const copyShareLink = () => {
        navigator.clipboard.writeText(invite_link()).then(() => {
            notify(true, 'Copied link to clipboard', true)
        });
    }

    const invite_link = () => {
        return window.location.origin + "/collections?import="+ props.id
    }

    const extra = <div style={{display: "flex", alignItems: "center", fontSize: "1.2em"}}>
        <DeleteConfirm delete={deleteSelf} />
        <ShareAltOutlined id={INVITE_LINK + props.id} style={{cursor: "pointer"}} onClick={copyShareLink}/>
    </div>

    const r_count = props.questions?.length
    const r_label = r_count + " Question" + (r_count !== 1 ? "s" : "")
    const title = props.name === '' ? "[unnamed collection]" : props.name

    return (
        <Card size="small" title={title} extra={extra}
              style={{width: 200, margin: 5}} >
            <div> {r_label} </div>
        </Card>
    );
}