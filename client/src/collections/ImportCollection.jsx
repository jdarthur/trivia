import React, {useState} from 'react';

import {Button, Card, Modal, Tag} from 'antd';
import {useGetCollectionQuery, useImportCollectionMutation} from "../api/main";
import FormattedQuestion from "../question/FormattedQuestion";
import {Link, useNavigate} from "react-router-dom";
import notify, {errorMessage} from "../common/notify";


import {
    LoginOutlined
} from '@ant-design/icons';

export default function ImportCollection(props) {

    const [success, setSuccess] = useState(false);
    const [message, setMessage] = useState(null)

    const {data, isFetching} = useGetCollectionQuery(props.id)
    const navigate = useNavigate();

    const [importCollection, importResult] = useImportCollectionMutation()

    const submit = async () => {
        const response = await importCollection(props.id)
        if (response.error) {
            const desc = errorMessage("import", "collection", response.error)
            notify(false, desc)
        } else {
            setSuccess(true)
            const message = (<div style={{fontSize: "1.3em", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 200, justifyContent: "space-around"}}>
                <div>
                    Successfully imported collection
                    <Tag style={{fontSize: '1em', margin: 5}}>{data?.name}</Tag>
                </div>
                <div>
                    <Link to={"/questions"}>
                        View Now
                        <LoginOutlined style={{marginLeft: 10}}/>
                    </Link>
                </div>

            </div>)
            setMessage(message)
        }
    }

    const questions = data?.question_data?.map((question) =>
        <Card title={question.category} style={{margin: 10}} bodyStyle={{padding: 0}}>
            <div style={{height: 250, width: 350, overflowY: "auto", padding: 10}}>
                <FormattedQuestion question={question.question} answer={question.answer}/>
            </div>
        </Card>)

    let questionLabel = "question" + (questions?.length === 1 ? "" : "s")
    const title = <span>
        Import Collection
        <Tag style={{fontSize: '1em', margin: 5}}>{data?.name}</Tag>
        ({questions?.length} {questionLabel})
    </span>

    const footer = <>
        <Button type="primary" onClick={submit} loading={importResult?.isFetching}> Import </Button>
    </>


    return (
        <Modal
            title={title}
            visible={true}
            width={success? "500" : "70vw"}
            onCancel={() => navigate("/collections")}
            footer={success? null : footer} >
            {success ? null : "Questions:"}
            <div style={{display: "flex", flexWrap: "wrap"}}>
                {success ? null : questions}
            </div>
            {success ? message: null}
        </Modal>
    )
}
