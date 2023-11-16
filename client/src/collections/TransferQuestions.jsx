import React from "react";
import {Transfer} from "antd";

export default function TransferQuestions(props) {

    const onChange = (newTargetKeys, direction, moveKeys) => {
        props.setQuestionIds(newTargetKeys)
    };

    const data = normalizeData(props.data)

    return <Transfer
        dataSource={data}
        pagination
        listStyle={{width: 250}}
        render={(item) => renderQuestion(item)}
        onChange={onChange}
        targetKeys={props.selected}>
    </Transfer>
}

function normalizeData(data) {
    const d = []
    for (let i = 0; i < data?.length; i++) {
        const value = {...data[i]}
        value.key = data[i].id
        d.push(value)
    }
    return d
}

function renderQuestion(item) {
    return <span>
        <b>{item.category}</b>:
        <span> {item.question} </span>
        <i>({item.answer? item.answer : "no answer"})</i>
    </span>
}
