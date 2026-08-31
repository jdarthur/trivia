import React, {useMemo, useState} from "react";
import {Checkbox, Input, Transfer} from "antd";
import "./TransferQuestions.css";
import type {Question} from "../types/models";
import CategoryName from "../category/CategoryName";

interface Props {
    data?: Question[]
    setQuestionIds: (ids: string[]) => void
    selected: string[]
    /** Column headers for the two lists ("Available questions" / "… in round"). */
    titles?: React.ReactNode[]
    /** Show the search box + "Unused only" toggle, as on the editor list pages. */
    showFilters?: boolean
    /** What "unused" means here; defaults to "not used by any round". */
    unusedFilter?: (item: Question) => boolean
}

export default function TransferQuestions(props: Props) {
    const [textFilter, setTextFilter] = useState("")
    const [unusedOnly, setUnusedOnly] = useState(false)

    const onChange = (newTargetKeys: React.Key[]) => {
        props.setQuestionIds(newTargetKeys as string[])
    };

    const isUnused = useMemo(
        () => props.unusedFilter ?? ((item: Question) => !item.rounds_used || item.rounds_used.length === 0),
        [props.unusedFilter]
    )

    // Client-side filter over the full question list (the editor pages filter
    // server-side; the transfer needs the whole list to offer every question).
    // Questions already selected always stay visible, so toggling "Unused only"
    // can never hide questions the round already contains.
    const data = useMemo(() => {
        const all = normalizeData(props.data)
        const selectedSet = new Set(props.selected)
        const needle = textFilter.trim().toLowerCase()
        return all.filter((item: any) => {
            if (selectedSet.has(item.key)) {
                return true
            }
            if (unusedOnly && !isUnused(item)) {
                return false
            }
            if (!needle) {
                return true
            }
            return (item.question || "").toLowerCase().includes(needle) ||
                (item.answer || "").toLowerCase().includes(needle)
        })
    }, [props.data, props.selected, textFilter, unusedOnly, isUnused])

    const filters = props.showFilters ?
        <div style={{display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 12}}>
            <Input.Search placeholder="Search" style={{width: 220}}
                          onChange={(event) => setTextFilter(event.target.value)}/>
            <Checkbox style={{marginLeft: 10}} checked={unusedOnly}
                      onChange={(event) => setUnusedOnly(event.target.checked)}>
                Unused only
            </Checkbox>
        </div> : null

    return <>
        {filters}
        <Transfer
            className="transfer-questions"
            dataSource={data}
            pagination
            render={(item) => renderQuestion(item)}
            onChange={onChange}
            targetKeys={props.selected}
            titles={props.titles ?? ["Available questions", "Selected questions"]}>
        </Transfer>
    </>
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
        <b><CategoryName id={item.category}/></b>
        <span> {item.question} </span>
        <i>({item.answer? item.answer : "no answer"})</i>
    </span>
}
