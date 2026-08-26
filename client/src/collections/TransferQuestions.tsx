import React from "react";
import {Transfer} from "antd";
import type {Question} from "../types/models";
import CategoryName from "../category/CategoryName";

interface Props {
    data?: Question[]
    setQuestionIds: (ids: string[]) => void
    selected: string[]
}

export default function TransferQuestions(props: Props) {

    const onChange = (newTargetKeys: React.Key[], direction: any, moveKeys: any) => {
        props.setQuestionIds(newTargetKeys as string[])
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

function normalizeData(data: Question[] | undefined) {
    const d: any[] = []
    if (!data) {
        return d
    }
    for (let i = 0; i < data.length; i++) {
        const value: any = {...data[i]}
        value.key = data[i].id
        d.push(value)
    }
    return d
}

function renderQuestion(item: any) {
    return <span>
        <b><CategoryName id={item.category}/></b>:
        <span> {item.question} </span>
        <i>({item.answer? item.answer : "no answer"})</i>
    </span>
}
