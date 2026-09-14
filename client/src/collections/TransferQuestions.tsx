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
    /** Start with the "Unused only" toggle on. */
    defaultUnusedOnly?: boolean
    /** Reports the questions checked on the left (available) list, so the caller
     *  can warn about selections that were never moved into the target list. */
    onSelectedChange?: (leftSelected: string[]) => void
}

export default function TransferQuestions(props: Props) {
    const [textFilter, setTextFilter] = useState("")
    const [unusedOnly, setUnusedOnly] = useState(props.defaultUnusedOnly ?? false)
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])

    // Only left-side checks count as "unsaved" — anything already in the target
    // list is part of the round, so report the checked keys that are not targets.
    const reportLeft = (targetKeys: React.Key[], selected: React.Key[]) => {
        const targetSet = new Set(targetKeys)
        props.onSelectedChange?.(selected.filter(key => !targetSet.has(key)) as string[])
    }

    const onSelectChange = (sourceSelected: React.Key[], targetSelected: React.Key[]) => {
        const next = [...sourceSelected, ...targetSelected]
        setSelectedKeys(next)
        props.onSelectedChange?.(sourceSelected as string[])
    }

    // antd orders the new target list itself (it prepends each move, so a
    // 3-4-1-2 sequence comes back 2-1-4-3). The caller owns the order — a round
    // asks its questions in the order they were moved in — so rebuild it here:
    // keep the current order, append what moved in (in move order) at the end,
    // drop what moved out.
    const onChange = (_newTargetKeys: React.Key[], direction: string, moveKeys: React.Key[]) => {
        const moved = new Set(moveKeys)
        const kept = props.selected.filter(id => !moved.has(id))
        const nextTargets = direction === 'right' ? [...kept, ...moveKeys] : kept
        props.setQuestionIds(nextTargets as string[])

        const nextSelected = selectedKeys.filter(key => !moved.has(key))
        setSelectedKeys(nextSelected)
        reportLeft(nextTargets, nextSelected)
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
            selectedKeys={selectedKeys}
            onSelectChange={onSelectChange}
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
