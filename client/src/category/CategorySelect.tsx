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

    const options = [
        <Select.Option value={""} label={"None"} key={"none"}>
            <span>None</span>
        </Select.Option>
    ]

    ;(categories || []).forEach((item) => {
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
                    dropdownRender={menu => newButton(menu)}>
                {options}
            </Select>
        </span>
    )
}
