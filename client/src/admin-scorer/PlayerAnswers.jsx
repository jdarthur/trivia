import React from 'react';
import ScorerLink from "./ScorerLink.jsx"
import MultiAnswer from "./MultiAnswer"

import {Button, Card, InputNumber, Popover, Slider, Space} from "antd"

import {
    CheckOutlined, CloseOutlined, SlidersOutlined,
} from '@ant-design/icons';
import ShortTextWithPopover from "../common/ShortTextWithPopover";

export default function PlayerAnswers({
                                          player_id,
                                          set_correct,
                                          set_override,
                                          correct,
                                          override_value,
                                          answers,
                                          session_id,
                                          player_name
                                      }) {

    // on new answer, clear out the existing score

    const setCorrect = () => {
        set_correct(player_id, true)
    }

    const setIncorrect = () => {
        set_correct(player_id, false)
    }

    const setOverride = (value) => {
        set_override(player_id, value)
    }

    const incorrectButtonStyle = correct === false ? {background: "#ffccc7"} : {}
    const correctButtonStyle = correct === true ? {background: "#d9f7be"} : {}

    let answer_text = <MultiAnswer answers={answers}/>

    let override = correct === false ? 0 : override_value
    const wager = <div style={{paddingLeft: '10px', fontSize: '1.3em', fontWeight: 'bold'}}>
        {answers?.length > 0 ? answers[answers?.length - 1].wager : null}
    </div>

    const modalContent = <div style={{width: 200, display: "flex", flexDirection: "column"}}>
        <Slider min={-10} max={10} step={0.5} value={override} onChange={setOverride} style={{flexGrow: 1}}/>
        <InputNumber value={override} onChange={setOverride} step={0.5}
                     style={{flexGrow: 0, width: "5em", alignSelf: "flex-end"}}/>
    </div>

    const sliderMiniModal = <Popover title={"Score override"} content={modalContent} trigger={"click"}>
        <SlidersOutlined style={{fontSize: "1.3em"}}/>
    </Popover>


    const title = <div>
        <ScorerLink session_id={session_id} player_id={player_id}/>
        <ShortTextWithPopover text={player_name} maxLength={20}/>
    </div>

    let correctButtonText = ""
    if (correct === true) {
        correctButtonText = override === 0 ? wager : override
    }

    return (

        <Card size="small" title={title} extra={correct === true ? sliderMiniModal : wager}
              style={{'width': 200}} bodyStyle={{padding: 0}}>
            <div className="answered-or-not"> {answer_text} </div>

            {answers?.length > 0 ?
                <div className="score-and-override">
                    <div className="answer-scorer">

                        <Space>
                            <Button size={"large"} onClick={setIncorrect} style={incorrectButtonStyle}>
                                <CloseOutlined/>
                            </Button>

                            <Button size={"large"} onClick={setCorrect} style={correctButtonStyle}>
                                <span>
                                    <CheckOutlined style={{marginRight: correct === true ? "0.5em" : 0}}/>
                                    {correctButtonText}
                                </span>

                            </Button>
                        </Space>

                        {/*<div onClick={() => set_correct(player_id, false)} className={incorrect_class}>*/}
                        {/*    <CloseSquareOutlined/>*/}
                        {/*</div>*/}
                        {/*<div onClick={() => set_correct(player_id, true)} className={correct_class}>*/}
                        {/*    <CheckSquareOutlined/>*/}
                        {/*</div>*/}
                        {/*<div onClick={() => set_correct(player_id, true)} className={correct_class}>*/}
                        {/*    <SlidersOutlined/>*/}
                        {/*</div>*/}
                    </div>
                </div> : null}

        </Card>
    )
}
