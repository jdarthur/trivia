import React, {useState} from 'react';
import {Table} from "antd";
import {EditOutlined, FolderOpenOutlined} from '@ant-design/icons';
import LoadingOrView from "../editor/LoadingOrView";
import NewButton from "../editor/NewButton";
import DeleteConfirm from "../editor/DeleteConfirm";
import EditorFilter from "../editor/EditorFilter";
import ListPagination from "../editor/ListPagination";
import PageHeader from "../common/PageHeader";
import CategoryModal from "./CategoryModal";
import {useAllQuestions, useDeleteCategoryMutation, useGetCategoriesQuery, useGetScoringNotesQuery} from "../api/main";
import {useClampToFirstPage, useListFilters} from "../editor/useListFilters";
import notify, {errorMessage} from "../common/notify";
import QuestionsPreview from "../common/QuestionsPreview";
import type {Category, Question} from "../types/models";
import '../editor/EditorList.css';

interface Props {
    token?: string
}

/**
 * Category editor page (ticket #180): list the user's categories in a table
 * (ticket #197), with create / edit / delete (with confirmation). Each row
 * shows the category's scoring note, which lives on the category now (D2),
 * and its question count.
 *
 * Ticket #196 adds the shared filter/pagination controls: search by name and
 * an unused-only toggle (a category is unused when no question references it —
 * the server computes that, and sends the count as questions_used, which each
 * row shows). Categories default to showing everything, since this page is
 * where you go to see and tidy up the whole set.
 */
export default function CategoryList(props: Props) {

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)

    const filters = useListFilters()
    const {data, isLoading} = useGetCategoriesQuery(filters.query)
    const categories = data?.categories
    useClampToFirstPage(data, filters.page, filters.setPage)
    const {data: notes} = useGetScoringNotesQuery()

    const {data: allQuestions} = useAllQuestions()

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

    const delete_edit = (text: any, category: Category) => <span style={{fontSize: '1.2em'}}>
            <DeleteConfirm delete={() => del(category)} style={{paddingRight: 10}}/>
            <EditOutlined onClick={() => openEdit(category)}/>
        </span>

    // questions_used comes from the server (ticket #195): how many questions
    // reference this category. The clickable Tag (ticket #272) opens a popover
    // of abbreviated question/answer previews, resolved from the full question
    // list by category.
    const questions_tag = (text: any, category: Category) => {
        const questions: Question[] = (allQuestions || []).filter(q => q.category === category.id)
        return <QuestionsPreview questions={questions} count={category.questions_used}/>
    }

    const columns = [
        {title: "", render: delete_edit, width: '5em'},
        {title: 'Name', dataIndex: 'name', ellipsis: {showTitle: false}},
        {title: 'Scoring note', render: (text: any, category: Category) => {
            const note = noteText(category)
            return note || <span style={{color: "rgba(0, 0, 0, 0.25)", fontStyle: "italic"}}>No scoring note</span>
        }, ellipsis: {showTitle: false}},
        {title: 'Questions', render: questions_tag}
    ]

    const newButton = <NewButton on_click={openCreate}/>

    const header = <EditorFilter set_text_filter={filters.setTextFilter} set_unused_only={filters.setUnusedOnly}
                                data_type="categories" text_filter={filters.textFilter}
                                unused_only={filters.unusedOnly} add_button={newButton}/>

    const modal = <CategoryModal visible={modalOpen} setVisible={setModalOpen} category={editing}/>

    const table_and_pager = <div className="table_and_pager">
        <Table columns={columns} dataSource={categories} pagination={false}
               size="small" rowKey="id"/>
        <ListPagination meta={data} page={filters.page} pageSize={filters.pageSize}
                        set_page={filters.setPage} set_page_size={filters.setPageSize}/>
    </div>

    return <div className="ql_and_filter">
        <PageHeader breadcrumbs={["Editor", <><FolderOpenOutlined/> Categories</>]} header={header} style={{marginBottom: 10}}/>
        <LoadingOrView class_name="category-list" loading={isLoading}
                       empty={categories?.length === 0}
                       loaded_view={table_and_pager}/>
        {modal}
    </div>
}
