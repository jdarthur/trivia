import React from 'react';
import './ActiveGame.css';

import {Breadcrumb, Card} from 'antd';
import {EditOutlined, PlaySquareOutlined} from '@ant-design/icons';
import FormattedQuestion from "../question/FormattedQuestion"
import HotEditQuestion from "./HotEditQuestion";

class ActiveQuestion extends React.Component {

    state = {
        editor_open: false
    }

    open = () => {
        this.setState({editor_open: true})
    }

    close = () => {
        this.setState({editor_open: false})
    }

    render() {
        // const question_newlined = this.props.question?.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

        const extra = this.props.editable ? <EditOutlined onClick={this.open} style={{paddingBottom: 10}}/> : null
        const editQuestionModal = this.state.editor_open ?
            <HotEditQuestion category={this.props.category} question={this.props.question} answer={this.props.answer}
                             close={this.close} session_id={this.props.session_id} player_id={this.props.player_id}
                             round_index={this.props.round_index} question_index={this.props.question_index} /> : null

        return (

            <Card style={{width: 'min(400px, 100%)', marginTop: 10}} bodyStyle={{padding: 20}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%"}}>
                    <Breadcrumb style={{paddingBottom: 10}}>
                        <Breadcrumb.Item>
                            <PlaySquareOutlined/>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item> {this.props.round_name} </Breadcrumb.Item>
                        <Breadcrumb.Item> {this.props.category} </Breadcrumb.Item>
                    </Breadcrumb>
                    {extra}
                </span>


                <div className="active-question-box">
                    <FormattedQuestion question={this.props.question}
                                       answer={this.props.answer} max_width={350}/>
                    {editQuestionModal}
                </div>
            </Card>
        );
    }
}

export default ActiveQuestion;