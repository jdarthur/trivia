import React from 'react';
import ScorerLink from "./ScorerLink"
import MultiAnswer from "./MultiAnswer"

import {Button, Card, InputNumber, Popover, Slider, Space, Tooltip} from "antd"

import {
    CheckOutlined, CloseOutlined, SlidersOutlined,
} from '@ant-design/icons';
import ShortTextWithPopover from "../common/ShortTextWithPopover";

interface AnswerLike {
    answer: string
    wager: number
    use_moneyball?: boolean
}

interface Props {
    player_id: string
    set_correct: (player_id: string, correct: boolean) => void
    set_override: (player_id: string, value: number | string | null) => void
    correct?: boolean
    override_value: number
    answers?: AnswerLike[]
    session_id: string
    player_name: string
    clear?: (player_id: string) => void
    auto_scored?: boolean
    question_type?: string
    // moneyball: the latest answer opted into the Moneyball mechanic, so its
    // points are computed by the backend (ticket #3) and the override slider
    // is disabled.
    moneyball?: boolean
}

export default function PlayerAnswers({
                                          player_id,
                                          set_correct,
                                          set_override,
                                          correct,
                                          override_value,
                                          answers,
                                          session_id,
                                          player_name,
                                          auto_scored,
                                          question_type,
                                          moneyball
                                      }: Props) {

    // on new answer, clear out the existing score

    const setCorrect = () => {
        set_correct(player_id, true)
    }

    const setIncorrect = () => {
        set_correct(player_id, false)
    }

    const setOverride = (value: number | string | null) => {
        set_override(player_id, value)
    }

    const incorrectButtonStyle = correct === false ? {background: "#ffccc7"} : {}
    const correctButtonStyle = correct === true ? {background: "#d9f7be"} : {}

    let answer_text = <MultiAnswer answers={answers} question_type={question_type}/>

    let override = correct === false ? 0 : override_value
    const wager = <div style={{paddingLeft: '10px', fontSize: '1.3em', fontWeight: 'bold'}}>
        {answers && answers.length > 0 ? answers[answers.length - 1].wager : null}
    </div>

    // Moneyball answers are scored by the backend formula (ticket #3), so the
    // mod's score-override slider is replaced with a 🤑 marker + wager.
    const moneyballBadge = <Tooltip title="Moneyball: points are auto-computed (2X lone correct / normal with 1 other / 0 with 2+ others / −1X wrong)">
        <span style={{fontSize: "1.3em"}}>🤑 {answers && answers.length > 0 ? answers[answers.length - 1].wager : null}</span>
    </Tooltip>

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

    let correctButtonText: React.ReactNode = ""
    if (correct === true) {
        // moneyball players have no meaningful override; show the wager
        correctButtonText = moneyball ? wager : (override === 0 ? wager : override)
    }

    return (

        <Card size="small" title={title} extra={moneyball ? moneyballBadge : (correct === true ? sliderMiniModal : wager)}
              style={{'width': 200}} bodyStyle={{padding: 0}}>
            <div className="answered-or-not"> {answer_text} </div>

            {/* For auto-scored question types the backend judges correctness, so
                the manual correct/incorrect buttons are hidden; the override
                slider (via `extra` above) is still available. */}
            {answers && answers.length > 0 && !auto_scored ?
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
