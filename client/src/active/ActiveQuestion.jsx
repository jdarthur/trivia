import React from 'react';
import './ActiveGame.css';

import {Breadcrumb, Card} from 'antd';
import {EditOutlined, PlaySquareOutlined} from '@ant-design/icons';
import FormattedQuestion from "../question/FormattedQuestion"
import HotEditQuestion from "./HotEditQuestion";
import HotEditRoundName from "./HotEditRoundName";

class ActiveQuestion extends React.Component {

    state = {
        question_editor_open: false,
        round_editor_open: false
    }

    open_question_editor = () => {
        this.setState({question_editor_open: true})
    }

    close_question_editor = () => {
        this.setState({question_editor_open: false})
    }

    open_round_editor = () => {
        if (this.props.editable) {
            this.setState({round_editor_open: true})
        }
    }

    close_round_editor = () => {
        this.setState({round_editor_open: false})
    }


    render() {
        // const question_newlined = this.props.question?.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

        const extra = this.props.editable ? <EditOutlined onClick={this.open_question_editor} style={{paddingBottom: 10}}/> : null
        const editQuestionModal = this.state.question_editor_open ?
            <HotEditQuestion category={this.props.category} question={this.props.question} answer={this.props.answer}
                             close={this.close_question_editor} session_id={this.props.session_id} player_id={this.props.player_id}
                             round_index={this.props.round_index} question_index={this.props.question_index}/> : null


        const roundName = this.state.round_editor_open ?
            <HotEditRoundName round_index={this.props.round_index} round_name={this.props.round_name}
                              close={this.close_round_editor} session_id={this.props.session_id}
                              player_id={this.props.player_id}/> :
            <span onClick={this.open_round_editor}> {this.props.round_name} </span>

        return (
            <Card style={{width: 'min(400px, 100%)', marginTop: 10}} bodyStyle={{padding: 20}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%"}}>
                    <Breadcrumb style={{paddingBottom: 10}}>
                        <Breadcrumb.Item>
                            <PlaySquareOutlined/>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item> {roundName} </Breadcrumb.Item>
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