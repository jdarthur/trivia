import {Tooltip} from "antd";
import React from "react";

export default function ShortTextWithPopover({text, maxLength}) {

    let usePopover = false
    let displayText = text

    if (text?.length > maxLength) {
        displayText = text.substring(0, maxLength) + "…"
        usePopover = true
    }

    if (usePopover) {
        return <Tooltip title={text}>
            {displayText}
        </Tooltip>
    } else {
        return <span>{text}</span>
    }
}

