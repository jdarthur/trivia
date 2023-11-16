import {Input, Modal} from "antd";
import React, {useState} from "react";
import {useCreateScoringNoteMutation} from "../api/main";

export default function CreateScoringNote(props) {

    const [name, setName] = useState("")
    const [description, setDescription] = useState("")

    const [create] = useCreateScoringNoteMutation()

    const createScoringNote = () => {
        const body = {
            name: name,
            description: description
        }

        create(body)
        props.setVisible(false)
    }

    return <Modal
        visible={props.visible}
        onOk={() => createScoringNote()}
        title={"New scoring note"}
        onCancel={() => props.setVisible(false)}
        width="350px"
    >
        <span style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10}}>
            <span style={{marginRight: 10}}>
                Name:
            </span>
            <Input placeholder={"Name"} value={name}
                   onChange={(event) => setName(event.target.value)}
                   style={{width: 200}}/>
        </span>

        <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
            <span style={{marginRight: 10}}>
                Description:
            </span>
            <Input.TextArea placeholder={"Description"} value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            style={{width: 200}}/>
        </span>
    </Modal>
}