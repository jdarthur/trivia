import React, {useState} from 'react';
import {Card} from "antd";
import {EditOutlined} from '@ant-design/icons';
import LoadingOrView from "../editor/LoadingOrView";
import NewButton from "../editor/NewButton";
import DeleteConfirm from "../editor/DeleteConfirm";
import PageHeader from "../common/PageHeader";
import CategoryModal from "./CategoryModal";
import {useDeleteCategoryMutation, useGetCategoriesQuery, useGetScoringNotesQuery} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import type {Category} from "../types/models";

interface Props {
    token?: string
}

/**
 * Category editor page (ticket #180): list the user's categories as cards,
 * with create / edit / delete (with confirmation). Each card shows the
 * category's scoring note, which lives on the category now (D2).
 */
export default function CategoryList(props: Props) {

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)

    const {data: categories, isLoading} = useGetCategoriesQuery()
    const {data: notes} = useGetScoringNotesQuery()

    const [deleteCategory] = useDeleteCategoryMutation()

    const del = async (category: Category) => {
        const response = await deleteCategory(category.id)
        if (response.error) {
            const desc = errorMessage("delete", "category", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted category`)
        }
    }

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const openEdit = (category: Category) => {
        setEditing(category)
        setModalOpen(true)
    }

    const noteText = (category: Category) => {
        const note = (notes || []).find(n => n.id === category.scoring_note)
        return note?.description || ""
    }

    const cards = (categories || []).map((category) => (
        <Card key={category.id} size="small" title={category.name}
              extra={<span style={{display: "flex", alignItems: "center", fontSize: "1.2em"}}>
                  <EditOutlined style={{cursor: "pointer"}} onClick={() => openEdit(category)}/>
                  <DeleteConfirm delete={() => del(category)}/>
              </span>}
              style={{width: 250, margin: 5}}>
            <div>{noteText(category) || "No scoring note"}</div>
        </Card>
    ))

    const newButton = <NewButton on_click={openCreate}/>

    const modal = <CategoryModal visible={modalOpen} setVisible={setModalOpen} category={editing}/>

    return <div style={{display: "flex", flexWrap: "wrap", margin: 10, alignItems: "center"}}>
        <div className="ql_and_filter">
            <PageHeader breadcrumbs={["Editor", "Categories"]} header={newButton} style={{marginBottom: 10}}/>
            <LoadingOrView class_name="category-list" loading={isLoading}
                           empty={categories?.length === 0} loaded_view={cards}/>
        </div>

        {modal}
    </div>
}
