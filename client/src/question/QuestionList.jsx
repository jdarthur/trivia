import React, {useState} from 'react';
import './QuestionList.css';

import DeleteConfirm from "../editor/DeleteConfirm"
import EditorFilter from "../editor/EditorFilter.jsx"
import LoadingOrView from "../editor/LoadingOrView"
import EditQuestionController from './EditQuestionController';
import NewButton from "../editor/NewButton"

import {Table} from "antd"

import {EditOutlined} from '@ant-design/icons';
import PageHeader from "../common/PageHeader";
import {useDeleteQuestionMutation, useGetQuestionsQuery} from "../api/main";
import notify, {errorMessage} from "../common/notify";
import ScoringNoteRenderInList from "./ScoringNoteRenderInList";

function renderCategory(text, element) {

    let note = null
    if (element.scoring_note) {
        note = <ScoringNoteRenderInList id={element.scoring_note}/>
    }

    return <span style={{display: "flex", alignItems: "center"}}>
        {text}
        {note}
    </span>
}

export default function QuestionList() {

    const [unusedOnly, setUnusedOnly] = useState(true)
    const [textFilter, setTextFilter] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [selected, setSelected] = useState({})
    const [scoringNoteWasCleared, setScoringNoteWasCleared] = useState(false)

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

    const del = async (questionId) => {
        const response = await deleteQuestion(questionId)
        if (response.error) {
            const desc = errorMessage("delete", "question", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted question`)
        }
    }

    const selectQuestion = (record) => {
        setSelected(record)
        setShowModal(true)
    }

    const newQuestion = () => {
        setSelected({})
        setShowModal(true)
    }


    const delete_edit = (text, record) => <span style={{fontSize: '1.2em'}}>
            <DeleteConfirm delete={() => del(record.id)} style={{paddingRight: 10}}/>
            <EditOutlined onClick={() => selectQuestion(record)}/>
        </span>


    const columns = [
        {title: "", render: delete_edit, width: '5em'},
        {
            title: 'Category',
            dataIndex: 'category',
            ellipsis: {showTitle: false},
            render: renderCategory
        },
        {title: 'Question', dataIndex: 'question', ellipsis: {showTitle: false}, width: '50%'},
        {title: 'Answer', dataIndex: 'answer', ellipsis: {showTitle: false}}

    ]


    let question_editor = <EditQuestionController
        selected={selected} visible={showModal}
        delete={null} close={() => setShowModal(false)}
        scoringNoteWasCleared={scoringNoteWasCleared}
        setScoringNoteWasCleared={setScoringNoteWasCleared}
    />

    const nqb = <NewButton on_click={newQuestion}/>
    const pagination = {
        total: questions?.length || 0,
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
    }

    const scroll = {
        x: 500,
        y: false
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
