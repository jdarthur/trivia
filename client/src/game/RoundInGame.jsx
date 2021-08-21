import React from 'react';
import "./OpenGame.css"
import QuestionInRound from "./QuestionInRound"

import {Card, Collapse} from 'antd'
import {PlusSquareOutlined} from "@ant-design/icons";

const {Panel} = Collapse;

/**
 * This is a round inside of an open game. It shows
 * its questions and can be deleted from the game.
 */
class RoundInGame extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            questions: [],
            round_name: ""
        }
    }

    componentDidMount() {
        this.get_round()
    }

    get_round = () => {
        let url = "/editor/round/" + this.props.id

        fetch(url, {headers:{"borttrivia-token": this.props.token}})
            .then(response => response.json())
            .then(state => {
                console.log(state)
                this.setState({
                    questions: state.questions,
                    round_name: state.name
                })
            })
    }

    remove_self = () => {
        this.props.remove(this.props.id)
    }

    select_self = () => {
        this.props.select(this.props.id)
    }


    render() {
        const questions = this.state.questions.map((question_id) => (
            <QuestionInRound key={question_id} id={question_id} token={this.props.token}/>))

        let border = ""
        let extra = null
        if (this.props.addable) {
            extra = <PlusSquareOutlined style={{fontSize: "1.5em"}} onClick={this.select_self}/>
            border = this.props.selected ? "2px solid black" : ""
        }



        return (
            <div>
                <Card title={this.props.show_title ? this.state.round_name : null} size="small"
                      style={{width: 225, margin: 5, border: border}} bodyStyle={{padding: 0}} extra={extra}>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header={questions.length + " Questions "} key="3">
                            <div>
                                {questions.length > 0 ? questions : (
                                    <div className="empty-round"> No questions </div>)}
                            </div>
                        </Panel>
                    </Collapse>
                </Card>
            </div>)
    }
}


export default RoundInGame
