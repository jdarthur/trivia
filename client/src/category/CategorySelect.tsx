import React, {useState} from "react";
import {Button, Select} from "antd";
import {PlusSquareOutlined} from '@ant-design/icons';
import {useAllCategories} from "../api/main";
import CategoryModal from "./CategoryModal";

interface Props {
    category: string
    set_category: (value: string) => void
}

/**
 * Category selector for the question editor (and the gameplay hot-edit):
 * the user's categories plus an inline "New" modal (ticket #180, D5 — no
 * free-text fallback). The question stores the selected category's ID.
 */
export default function CategorySelect(props: Props) {

    const [showNewCategory, setShowNewCategory] = useState(false)

    const {data: categories} = useAllCategories()

    // Most-recently-used first (the server stamps category.last_used whenever
    // a question is saved using it). The timestamp is a sortable fixed-width
    // string, so lexical comparison is chronological; categories that have
    // never been used carry the zero-time value and sort last. Ties break by
    // create_date descending, matching the scoring-note picker.
    const sorted = [...(categories || [])].sort((a, b) => {
        if (a.last_used !== b.last_used) {
            return a.last_used < b.last_used ? 1 : -1
        }
        return a.create_date < b.create_date ? 1 : -1
    })

    const options = [
        <Select.Option value={""} label={"None"} key={"none"}>
            <span>None</span>
        </Select.Option>
    ]

    sorted.forEach((item) => {
        options.push(<Select.Option value={item.id} label={item.name} key={item.id}>
            <span>{item.name}</span>
        </Select.Option>)
    })

    const newCategoryModal = <CategoryModal visible={showNewCategory} setVisible={setShowNewCategory}/>

    const newButton = (menu: React.ReactNode) => {
        return <>
            {menu}
            <Button title={"New"}
                    onClick={() => setShowNewCategory(true)}
                    style={{width: 100, margin: "5px 12px 5px 12px"}}
            >
                <PlusSquareOutlined/>
                New
            </Button>
        </>
    }

    return (
        <span style={{display: "flex", alignItems: "center"}}>
            {newCategoryModal}
            <span style={{marginLeft: 10}}>Category: </span>
            <Select style={{marginLeft: 5, width: 200}} value={props.category}
                    onSelect={props.set_category}
                    showSearch
                    virtual={false}
                    filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    dropdownRender={menu => newButton(menu)}>
                {options}
            </Select>
        </span>
    )
}
