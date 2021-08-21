import React from 'react';
import '../modal/Modal.css';

import { Modal, Button, Table } from 'antd';

const columns = [
    { title: 'Category', dataIndex: 'category', ellipsis: { showTitle: false } },
    { title: 'Question', dataIndex: 'question', ellipsis: { showTitle: false}, width: '50%' },
    { title: 'Answer', dataIndex: 'answer', ellipsis: { showTitle: false } }
]

class AddQuestionsModal extends React.Component {


    state = {
        questions: [],
        selected_questions: [],
        is_open: false
    }


    componentDidMount() {
        this.get_questions()
    }

    get_questions = () => {
        let url = "/editor/questions?unused_only=true"
        // if (this.state.text_filter !== "") {
        //   url += "text_filter=" + this.state.text_filter
        // }

        // if (this.state.unused_only === true) {
        //   url += "&unused_only=true"
        // }

        fetch(url, {headers: {"borttrivia-token": this.props.token}})
            .then(response => response.json())
            .then(state => {
                console.log("got questions in addable questions")
                console.log(state)
                this.setState({ questions: state.questions })
            })
    }


    close_modal = () => {
        this.setState({ is_open: false, selected_questions: [], })
    }

    open_modal = () => {
        this.setState({ is_open: true }, () => {
            this.get_questions()
        })
    }

    add_questions_and_close = () => {
        this.props.add_questions(this.state.selected_questions)
        this.close_modal()
    }

    onSelectChange = selected_questions => {
        console.log('selected_questions changed: ', selected_questions);
        this.setState({ selected_questions });
    };

    render() {
        if (this.state.is_open === true) {
            this.state.questions.map((question) => question.key = question.id)

            const { selected_questions } = this.state;
            const rowSelection = {
                selected_questions,
                onChange: this.onSelectChange,
            };

            return (
                <Modal
                    title="Add Questions" visible={this.state.is_open}
                    onOk={this.add_questions_and_close} okText="Add"
                    onCancel={this.close_modal} width="70vw" >

                    <Table rowSelection={rowSelection} columns={columns}
                        dataSource={this.state.questions} pagination={false} />

                </Modal>
            );
        }
        else {
            return (

                <Button type="primary" onClick={this.open_modal} style={{ 'margin-bottom': '10px', 'margin-top': '10px' }}>
                    Add questions
                </Button>
            )
        }
    }
}

export default AddQuestionsModal;