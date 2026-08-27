import React from 'react';
import './ActiveGame.css';

import {Breadcrumb, Card, Tooltip} from 'antd';
import {EditOutlined, InfoCircleOutlined, PlaySquareOutlined} from '@ant-design/icons';
import FormattedQuestion, {MemoFormattedQuestion} from "../question/FormattedQuestion"
import HotEditQuestion from "./HotEditQuestion";
import HotEditRoundName from "./HotEditRoundName";

interface Props {
    session_state: any
    session_id: string
    question: string
    answer: string
    scored: boolean
    round_name: string
    category: string
    editable: boolean
    player_id: string
    round_index: number | string
    question_index: number | string
    scoring_note?: string
    scoring_note_id?: string
    question_type?: string
    choices?: string[]
    lefts?: string[]
    rights?: string[]
    buckets?: string[]
    items?: string[]
}

interface State {
    question_editor_open: boolean
    round_editor_open: boolean
}

class ActiveQuestion extends React.Component<Props, State> {

    state: State = {
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

        const extra = this.props.editable ?
            <EditOutlined onClick={this.open_question_editor} style={{paddingBottom: 10}}/> : null
        const editQuestionModal = this.state.question_editor_open ?
            <HotEditQuestion category={this.props.category} question={this.props.question} answer={this.props.answer}
                             close={this.close_question_editor} session_id={this.props.session_id}
                             player_id={this.props.player_id}
                             round_index={this.props.round_index}
                             question_index={this.props.question_index}
                             question_type={this.props.question_type}
                             choices={this.props.choices}
                             pairs={(this.props.lefts || []).map((left, index) => ({left, right: (this.props.rights || [])[index] || ""}))}
                             buckets={(this.props.buckets || []).map(text => ({text}))}
                             items={(this.props.items || []).map(text => ({text, bucket: ""}))}
            /> : null


        const roundName = this.state.round_editor_open ?
            <HotEditRoundName round_index={this.props.round_index} round_name={this.props.round_name}
                              close={this.close_round_editor} session_id={this.props.session_id}
                              player_id={this.props.player_id}/> :
            <span>
                {this.props.round_name}
                {this.props.editable ?
                    <EditOutlined onClick={this.open_round_editor}
                                  style={{fontSize: '0.9em', cursor: 'pointer', paddingLeft: '0.5em'}}/> : null}
            </span>

        const scoringNote = this.props.scoring_note !== "" ?
            <Tooltip title={this.props.scoring_note} placement={"bottom"}>
                <InfoCircleOutlined style={{marginLeft: "0.5em"}}/>
            </Tooltip> : null

        // Ticket #160: once a multiple-choice question is scored, the option
        // list below already shows the correct answer (✅ + bold), so the
        // standalone answer line is hidden to avoid duplicating it.
        const mcScored = this.props.scored && this.props.question_type === "multiple_choice"

        return (
            <Card className="question-card" bodyStyle={{padding: 20}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%"}}>
                    <Breadcrumb style={{paddingBottom: 10}}>
                        <Breadcrumb.Item>
                            <PlaySquareOutlined/>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item> {roundName} </Breadcrumb.Item>
                        <Breadcrumb.Item>
                            {this.props.category}
                            {scoringNote}
                        </Breadcrumb.Item>
                    </Breadcrumb>
                    {extra}
                </span>


                <div className="active-question-box">
                    <MemoFormattedQuestion question={this.props.question}
                                           answer={mcScored ? "" : this.props.answer} max_width={350}
                                           scored={mcScored ? false : this.props.scored}
                    />
                    {this.props.question_type === "multiple_choice" && (this.props.choices || []).length > 0 ?
                        <ol style={{marginTop: 10, paddingLeft: 20}}>
                            {(this.props.choices || []).map((choice, index) => {
                                // Ticket #160: once scored, mark the correct option
                                // (the one matching the answer text) with ✅ + bold
                                // and every other option with ❌.
                                const isCorrect = this.props.scored && choice === this.props.answer
                                return <li key={index} style={isCorrect ? {fontWeight: "bold"} : undefined}>
                                    {this.props.scored ? (isCorrect ? "✅ " : "❌ ") : null}{choice}
                                </li>
                            })}
                        </ol> : null}
                    {this.props.question_type === "matching" && (this.props.lefts || []).length > 0 ?
                        <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                            <tbody>
                                <tr>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.lefts || []).map((left, index) => <li key={index}>{left}</li>)}
                                        </ul>
                                    </td>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.rights || []).map((right, index) => <li key={index}>{right}</li>)}
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table> : null}
                    {this.props.question_type === "bucketing" && (this.props.items || []).length > 0 ?
                        <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                            <tbody>
                                <tr>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.items || []).map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                    </td>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.buckets || []).map((bucket, index) => <li key={index}>{bucket}</li>)}
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table> : null}
                    {editQuestionModal}
                </div>
            </Card>
        );
    }
}

export default ActiveQuestion;
