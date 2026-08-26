import React from 'react';
import '../question/Question.css';

import {Button} from 'antd';
import EditQuestionModal from "../question/EditQuestionModal";
import type {QuestionBucket, QuestionBucketItem, QuestionChoice, QuestionPair} from "../types/models";

interface Props {
    category: string
    question: string
    answer: string
    close: () => void
    session_id: string
    player_id: string
    round_index: number | string
    scoring_note?: string
    question_index: number | string
    question_type?: string
    choices?: string[]
    pairs?: QuestionPair[]
    buckets?: QuestionBucket[]
    items?: QuestionBucketItem[]
}

interface State {
    category: string
    question: string
    answer: string
    scoring_note?: string
    saving: boolean
}

class HotEditQuestion extends React.Component<Props, State> {

    state: State = {
        category: this.props.category,
        question: this.props.question,
        answer: this.props.answer,
        scoring_note: this.props.scoring_note,
        saving: false,
    }

    set_value = (key: string, value: string) => {
        console.log("set ", key, " to ", value)
        this.setState({[key]: value} as unknown as State)
    }

    structured = () => {
        return this.props.question_type === "multiple_choice"
            || this.props.question_type === "matching"
            || this.props.question_type === "bucketing"
    }

    save_self = () => {
        if (this.state.saving) {
            return
        }
        console.log("save")

        const question = {
            round_index: this.props.round_index,
            question_index: this.props.question_index,
            question: {
                category: this.state.category,
                question: this.state.question,
                answer: this.structured() ? this.props.answer : this.state.answer,
                scoring_note: this.state.scoring_note,
                question_type: this.props.question_type
            }
        }

        // Guard double-clicks on Update (ticket #147).
        this.setState({saving: true})
        save(this.props.session_id, this.props.player_id, question)
            .then((data: any) => {
                this.props.close()
            })
            .catch((error: any) => {
                console.log(error)
            })
            .finally(() => {
                this.setState({saving: false})
            })
    }

    disabled = () => {
        if (this.state.saving) {
            return true
        }
        if (this.structured()) {
            return this.props.category === "" || this.props.question === ""
        }
        return this.props.category === "" || this.props.question === "" || this.props.answer === ""
    }

    render() {
        const footer = <div className="save-delete">
            <Button className="button" type="primary" disabled={this.disabled()}
                    onClick={this.save_self}> Update </Button>
        </div>


        return (
            <EditQuestionModal title="Edit Question" cancel={this.props.close}
                               save_text="Update" save_action={this.save_self}
                               question={this.state.question} answer={this.state.answer}
                               category={this.state.category} footer={footer}
                               set_question={(value) => this.set_value("question", value)}
                               set_category={(value) => this.set_value("category", value)}
                               set_answer={(value) => this.set_value("answer", value)}
                               scoring_note={this.state.scoring_note as string}
                               set_scoring_note={(value) => this.set_value("scoring_note", value)}
                               question_type={this.props.question_type}
                               choices={(this.props.choices || []).map((text, index) => ({
                                   text: text, is_correct: false
                               }))}
                               pairs={this.props.pairs}
                               buckets={this.props.buckets}
                               items={this.props.items}
                               disabled={this.structured()}
                               visible={true}/>
        );
    }
}

async function save(session_id: string, player_id: string, question_data: any): Promise<any> {
    const url = "/gameplay/session/" + session_id + "/hot-edit-question?player_id=" + player_id
    const response = await fetch(url, {
        method: "PUT",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(question_data)
    })
    return response.json()
}

export default HotEditQuestion
