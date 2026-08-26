import React, {useState} from 'react';
import './QuestionList.css';

import DeleteConfirm from "../editor/DeleteConfirm"
import EditorFilter from "../editor/EditorFilter"
import LoadingOrView from "../editor/LoadingOrView"
import EditQuestionController from './EditQuestionController';
import NewButton from "../editor/NewButton"

import {Table} from "antd"

import {EditOutlined} from '@ant-design/icons';
import PageHeader from "../common/PageHeader";
import {useDeleteQuestionMutation, useGetQuestionsQuery} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import CategoryName from "../category/CategoryName";
import type {Question} from "../types/models";

interface Props {
    token?: string
}

export default function QuestionList(props: Props) {

    const [unusedOnly, setUnusedOnly] = useState(true)
    const [textFilter, setTextFilter] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [selected, setSelected] = useState<Partial<Question>>({})

    let query = ""
    if (unusedOnly) {
        query += "?unused_only=true"
    }
    if (textFilter) {
        query += unusedOnly ? "&text_filter=" + textFilter : "?text_filter=" + textFilter
    }

    const {data, isFetching} = useGetQuestionsQuery(query)

    const questions = data?.questions;

    const [deleteQuestion] = useDeleteQuestionMutation()

    const del = async (questionId: string) => {
        const response = await deleteQuestion(questionId)
        if (response.error) {
            const desc = errorMessage("delete", "question", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted question`)
        }
    }

    const selectQuestion = (record: Question) => {
        setSelected(record)
        setShowModal(true)
    }

    const newQuestion = () => {
        setSelected({})
        setShowModal(true)
    }


    const delete_edit = (text: any, record: Question) => <span style={{fontSize: '1.2em'}}>
            <DeleteConfirm delete={() => del(record.id)} style={{paddingRight: 10}}/>
            <EditOutlined onClick={() => selectQuestion(record)}/>
        </span>


    const columns = [
        {title: "", render: delete_edit, width: '5em'},
        {
            title: 'Category',
            dataIndex: 'category',
            ellipsis: {showTitle: false},
            // category is the category's ID (ticket #180); resolve it to the
            // name and show the category's scoring note (which now lives on
            // the category, D2) as an info icon.
            render: (id: string) => <CategoryName id={id} show_note/>
        },
        {title: 'Question', dataIndex: 'question', ellipsis: {showTitle: false}, width: '50%'},
        {title: 'Answer', dataIndex: 'answer', ellipsis: {showTitle: false}}

    ]


    let question_editor = <EditQuestionController
        selected={selected} visible={showModal}
        delete={null} close={() => setShowModal(false)}
    />

    const nqb = <NewButton on_click={newQuestion}/>
    const pagination = {
        total: questions?.length || 0,
        showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total}`
    }

    const scroll = {
        x: 500,
        y: false as any
    }

    const table_and_modal = <div>

        <Table columns={columns} dataSource={questions} pagination={pagination}
               scroll={scroll} size="small" style={{maxWidth: 1500}} rowKey={"id"}/>
    </div>

    const header = <EditorFilter set_text_filter={setTextFilter} set_unused_only={setUnusedOnly}
                                 data_type="questions" text_filter={textFilter} unused_only={unusedOnly}
                                 add_button={nqb}/>

    return (
        <div className="ql_and_filter">
            <PageHeader breadcrumbs={["Editor", "Questions"]} header={header} style={{marginBottom: 10}}/>
            {question_editor}
            <LoadingOrView loading={isFetching} class_name="question-list"
                           empty={questions?.length === 0} loaded_view={table_and_modal}/>
        </div>
    );
}
