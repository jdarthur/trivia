import {notification, Typography} from "antd";
import React from "react";

export default function notify(success, message, noHeader) {
    let m = null
    if (!noHeader) {
        m = success ? "Success" : "Error"
    }

    notification.open({
        type: success ? "success" : "error",
        message: m,
        description: message
    })
}

export function errorMessage(verb, noun, err) {
    return <div>
        <div>Unable to {verb} {noun}.</div>
        Error: <Typography.Text code >{err?.data?.message} </Typography.Text>
    </div>
}