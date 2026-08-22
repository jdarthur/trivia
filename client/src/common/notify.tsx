import {notification, Typography} from "antd";
import React from "react";

export default function notify(success: boolean, message: React.ReactNode, noHeader?: boolean): void {
    let m: string | null = null
    if (!noHeader) {
        m = success ? "Success" : "Error"
    }

    notification.open({
        type: success ? "success" : "error",
        message: m,
        description: message
    })
}

export function errorMessage(verb: string, noun: string, err: any) {
    return <div>
        <div>Unable to {verb} {noun}.</div>
        Error: <Typography.Text code >{err?.data?.message} </Typography.Text>
    </div>
}
