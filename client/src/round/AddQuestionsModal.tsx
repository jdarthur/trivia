import React, {useState} from 'react';
import '../modal/Modal.css';

import {Button, Modal, Space, Table} from 'antd';
import EditorFilter from "../editor/EditorFilter";
import {useGetQuestionsQuery} from "../api/main";
import {buildListQuery} from "../api/listParams";
import CategoryName from "../category/CategoryName";
import type {Question} from "../types/models";

interface Props {
    add_questions: (question_ids: string[]) => void
    questions?: string[]
    save?: () => void
    token?: string
}

const columns = [
    // category is the category's ID (ticket #180); resolve it to the name.
    {title: 'Category', dataIndex: 'category', ellipsis: {showTitle: false},
     render: (id: string) => <CategoryName id={id}/>},
    {title: 'Question', dataIndex: 'question', ellipsis: {showTitle: false}, width: '50%'},
    {title: 'Answer', dataIndex: 'answer', ellipsis: {showTitle: false}}
]

export default function AddQuestionsModal(props: Props) {

    const [unusedOnly, setUnusedOnly] = useState(false)
    const [textFilter, setTextFilter] = useState("")
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // No page/page_size: the picker needs the whole filtered list at once so a
    // selection can't be lost by paging away from it (ticket #196 calls out that
    // pagination is not critical here). The table slices it client-side.
    const query = buildListQuery({unused_only: unusedOnly, text_filter: textFilter})

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
        props.add_questions(selectedQuestions)
        close_modal()
    }

    const onSelectChange = (selected_questions: React.Key[]) => {
        console.log('selected_questions changed: ', selected_questions);
        setSelectedQuestions(selected_questions as string[])
    };

    const title = <Space>
        <span>Add questions</span>
        {header}
    </Space>


    if (isOpen) {

        const x = questions?.map((question: Question) => {
            return {...question, key: question.id};
        })
        console.log(x)

        const rowSelection = {
            x,
            onChange: onSelectChange,
        };

        const pagination = {
            total: questions?.length || 0,
            showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total}`
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
