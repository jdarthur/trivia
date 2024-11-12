import React, {useState} from 'react';
import '../modal/Modal.css';

import {Button, Modal, Space, Table} from 'antd';
import EditorFilter from "../editor/EditorFilter";
import {useGetQuestionsQuery} from "../api/main";

const columns = [
    {title: 'Category', dataIndex: 'category', ellipsis: {showTitle: false}},
    {title: 'Question', dataIndex: 'question', ellipsis: {showTitle: false}, width: '50%'},
    {title: 'Answer', dataIndex: 'answer', ellipsis: {showTitle: false}}
]

export default function AddQuestionsModal({add_questions, }) {

    const [unusedOnly, setUnusedOnly] = useState(false)
    const [textFilter, setTextFilter] = useState("")
    const [selectedQuestions, setSelectedQuestions] = useState([])
    const [isOpen, setIsOpen] = useState(false)

    let query = ""
    if (unusedOnly) {
        query += "?unused_only=true"
    }
    if (textFilter) {
        query += unusedOnly ? "&text_filter=" + textFilter : "?text_filter=" + textFilter
    }

    const {data, isFetching} = useGetQuestionsQuery(query)
    const questions = data?.questions;
    //console.log(questions)

    const header = <EditorFilter set_text_filter={setTextFilter} set_unused_only={setUnusedOnly}
                                 data_type="questions" text_filter={textFilter} unused_only={unusedOnly}/>

    const close_modal = () => {
        setSelectedQuestions([])
        setIsOpen(false)
    }

    const add_questions_and_close = () => {
        add_questions(selectedQuestions)
        close_modal()
    }

    const onSelectChange = (selected_questions) => {
        console.log('selected_questions changed: ', selected_questions);
        setSelectedQuestions(selected_questions)
    };

    const title = <Space>
        <span>Add questions</span>
        {header}
    </Space>


    if (isOpen) {

        const x = questions?.map((question) => {
            return {...question, key: question.id};
        })
        console.log(x)

        const rowSelection = {
            x,
            onChange: onSelectChange,
        };

        const pagination = {
            total: questions?.length || 0,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
        }

        return (
            <Modal
                title={title} open={isOpen}
                onOk={add_questions_and_close} okText="Add"
                onCancel={close_modal} width="70vw">

                <Table rowSelection={rowSelection} columns={columns}
                       dataSource={x} pagination={pagination}/>

            </Modal>
        );
    } else {
        return (
            <Button type="primary" onClick={() => setIsOpen(true)}
                    style={{marginBottom: 10, marginTop: 10}}>
                Add questions
            </Button>
        )
    }

}
