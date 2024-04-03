import React from 'react';
import '../question/Question.css';

import {Button} from 'antd';
import EditQuestionModal from "../question/EditQuestionModal";

class HotEditQuestion extends React.Component {

    state = {
        category: this.props.category,
        question: this.props.question,
        answer: this.props.answer,
        scoring_note: this.props.scoring_note,
    }

    set_value = (key, value) => {
        console.log("set ", key, " to ", value)
        this.setState({[key]: value})
    }

    save_self = () => {
        console.log("save")

        const question = {
            round_index: this.props.round_index,
            question_index: this.props.question_index,
            question: {
                category: this.state.category,
                question: this.state.question,
                answer: this.state.answer,
                scoring_note: this.state.scoring_note
            }
        }

        save(this.props.session_id, this.props.player_id, question).then((data) => {
            this.props.close()
        })
    }

    disabled = () => {
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
                               scoring_note={this.state.scoring_note}
                               set_scoring_note={(value) => this.set_value("scoring_note", value)}
                               visible={true}/>
        );
    }
}

async function save(session_id, player_id, question_data) {
    const url = "/gameplay/session/" + session_id + "/hot-edit-question?player_id=" + player_id
    const response = await fetch(url, {
        method: "PUT",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(question_data)
    })
    return response.json()
}

export default HotEditQuestion