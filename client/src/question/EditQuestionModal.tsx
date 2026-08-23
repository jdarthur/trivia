import React, {useState} from 'react';
import './Question.css';

import {Input, Modal, Radio, Button} from 'antd';
import {MinusCircleOutlined} from '@ant-design/icons';
import FormattedQuestion from "./FormattedQuestion"
import EditorToolbar from "./EditorToolbar";
import {ANSWER, CATEGORY, QUESTION} from "./EditQuestionController";
import ScoringNote from "./ScoringNote";
import type {QuestionChoice, QuestionPair} from "../types/models";

const {TextArea} = Input;

const EDIT = "Edit"
const PREVIEW = "Preview"

const FREEFORM = "freeform"
const MULTIPLE_CHOICE = "multiple_choice"
const MATCHING = "matching"

interface Props {
    title: string
    visible: boolean
    cancel: () => void
    save_text: string
    save?: () => void
    save_action?: () => void
    category: string
    question: string
    answer: string
    scoring_note: string
    footer: React.ReactNode
    set_category: (value: string) => void
    set_question: (value: string) => void
    set_answer: (value: string) => void
    set_scoring_note: (value: string) => void
    set_scoring_note_was_cleared?: (value: boolean) => void
    initialValues?: any
    question_type?: string
    set_question_type?: (value: string) => void
    choices?: QuestionChoice[]
    set_choices?: (choices: QuestionChoice[]) => void
    pairs?: QuestionPair[]
    set_pairs?: (pairs: QuestionPair[]) => void
    disabled?: boolean
}

export default function EditQuestionModal(props: Props) {

    const [selectedTab, setSelectedTab] = useState(EDIT)
    const [focusedInput, setFocusedInput] = useState(CATEGORY)

    const wrap = (wrapWith: string) => {
        const activeElement = document.getElementById(focusedInput) as HTMLInputElement | null
        if (activeElement) {
            const selectionStart = activeElement.selectionStart as number
            const selectionEnd = activeElement.selectionEnd as number
            if (activeElement.id === QUESTION) {
                const value = wrapValue(props.question, selectionStart, selectionEnd, wrapWith)
                console.log(value)
                props.set_question(value)
            }
            if (activeElement.id === ANSWER) {
                props.set_answer(wrapValue(props.answer, selectionStart, selectionEnd, wrapWith))
            }
        }
    }

    const wrap_line = (wrapWithBefore: string, wrapWithAfter: string) => {
        const activeElement = document.getElementById(focusedInput) as HTMLInputElement | null
        if (activeElement) {
            const selectionStart = activeElement.selectionStart as number
            const selectionEnd = activeElement.selectionEnd as number

            if (activeElement.id === QUESTION) {
                let value = props.question.slice(0, selectionStart)
                const selected = props.question.slice(selectionStart, selectionEnd)
                const selected_lines = selected.split("\n")

                selected_lines.forEach(line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                props.set_question(value + props.question.slice(selectionEnd))
            }
            if (activeElement.id === ANSWER) {
                let value = props.answer.slice(0, selectionStart)
                const selected = props.answer.slice(selectionStart, selectionEnd)
                const selected_lines = selected.split("\n")

                selected_lines.forEach(line => value += [wrapWithBefore, line, wrapWithAfter ? wrapWithAfter : ""].join(""))
                props.set_answer(value + props.answer.slice(selectionEnd))
            }
        }
    }

    const insert = (text: string) => {
        const activeElement = document.getElementById(focusedInput) as HTMLInputElement | null
        if (activeElement) {
            if (activeElement.id === QUESTION || activeElement.id === CATEGORY) {
                props.set_question(props.question + text)
            }
            if (activeElement.id === ANSWER) {
                props.set_answer(props.answer + text)
            }
        }
    }


    const set_choice_text = (index: number, value: string) => {
        const next = (props.choices || []).map((choice, i) => i === index ? {...choice, text: value} : choice)
        props.set_choices?.(next)
    }

    const set_choice_correct = (index: number) => {
        const next = (props.choices || []).map((choice, i) => ({...choice, is_correct: i === index}))
        props.set_choices?.(next)
    }

    const add_choice = () => {
        props.set_choices?.([...(props.choices || []), {text: "", is_correct: false}])
    }

    const remove_choice = (index: number) => {
        props.set_choices?.((props.choices || []).filter((_, i) => i !== index))
    }

    const set_pair_left = (index: number, value: string) => {
        const next = (props.pairs || []).map((pair, i) => i === index ? {...pair, left: value} : pair)
        props.set_pairs?.(next)
    }

    const set_pair_right = (index: number, value: string) => {
        const next = (props.pairs || []).map((pair, i) => i === index ? {...pair, right: value} : pair)
        props.set_pairs?.(next)
    }

    const add_pair = () => {
        props.set_pairs?.([...(props.pairs || []), {left: "", right: ""}])
    }

    const remove_pair = (index: number) => {
        props.set_pairs?.((props.pairs || []).filter((_, i) => i !== index))
    }

    const questionType = props.question_type || FREEFORM
    const correctIndex = (props.choices || []).findIndex(choice => choice.is_correct)

    const freeformView = <div>
        <TextArea autoFocus={!!props.category} placeholder="Question" value={props.question}
                  style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                  onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                  onPressEnter={null as any}/>

        <TextArea autoFocus={!!(props.category && props.question && !props.answer)}
                  placeholder="Answer" value={props.answer} autoSize={{minRows: 2}}
                  onClick={() => setFocusedInput(ANSWER)} onChange={(event) => props.set_answer(event.target.value)}
                  onPressEnter={null as any} id={ANSWER}/>
    </div>

    const structuredNote = props.disabled && questionType !== FREEFORM ?
        <div style={{marginBottom: 10, color: "#8c8c8c"}}>
            Options and answer key are not editable for this question type.
        </div> : null

    const choicesView = <div>
        <TextArea autoFocus={!!props.category} placeholder="Question" value={props.question}
                  style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                  onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                  onPressEnter={null as any}/>

        {structuredNote}
        <div style={{marginBottom: 10}}>
            {(props.choices || []).map((choice, index) => (
                <div key={index} style={{display: "flex", alignItems: "center", marginBottom: 6}}>
                    <Radio.Group value={correctIndex} onChange={() => set_choice_correct(index)} disabled={props.disabled}>
                        <Radio value={index}/>
                    </Radio.Group>
                    <Input placeholder="Choice" value={choice.text} style={{flexGrow: 1}} disabled={props.disabled}
                           onChange={(event) => set_choice_text(index, event.target.value)}/>
                    <MinusCircleOutlined onClick={() => remove_choice(index)} disabled={props.disabled}
                                         style={{marginLeft: 8, cursor: "pointer"}}/>
                </div>
            ))}
            <Button size="small" type="dashed" onClick={add_choice} disabled={props.disabled}> Add choice </Button>
        </div>
    </div>

    const pairsView = <div>
        <TextArea autoFocus={!!props.category} placeholder="Question" value={props.question}
                  style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                  onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                  onPressEnter={null as any}/>

        {structuredNote}
        <div style={{marginBottom: 10}}>
            {(props.pairs || []).map((pair, index) => (
                <div key={index} style={{display: "flex", alignItems: "center", marginBottom: 6}}>
                    <Input placeholder="Left" value={pair.left} style={{flexGrow: 1, marginRight: 6}} disabled={props.disabled}
                           onChange={(event) => set_pair_left(index, event.target.value)}/>
                    <Input placeholder="Right" value={pair.right} style={{flexGrow: 1}} disabled={props.disabled}
                           onChange={(event) => set_pair_right(index, event.target.value)}/>
                    <MinusCircleOutlined onClick={() => remove_pair(index)} disabled={props.disabled}
                                         style={{marginLeft: 8, cursor: "pointer"}}/>
                </div>
            ))}
            <Button size="small" type="dashed" onClick={add_pair} disabled={props.disabled}> Add pair </Button>
        </div>
    </div>

    const editView = questionType === MULTIPLE_CHOICE ? choicesView :
        questionType === MATCHING ? pairsView : freeformView

    const previewBody = () => {
        if (questionType === MULTIPLE_CHOICE) {
            return <div>
                <FormattedQuestion question={props.question} answer={""} max_width={425}/>
                <ol style={{marginTop: 10, paddingLeft: 20}}>
                    {(props.choices || []).map((choice, index) => <li key={index}>{choice.text}</li>)}
                </ol>
            </div>
        }
        if (questionType === MATCHING) {
            return <div>
                <FormattedQuestion question={props.question} answer={""} max_width={425}/>
                <table style={{marginTop: 10, borderCollapse: "collapse"}}>
                    {(props.pairs || []).map((pair, index) => (
                        <tr key={index}>
                            <td style={{border: "1px solid #d9d9d9", padding: "4px 8px"}}>{pair.left}</td>
                            <td style={{border: "1px solid #d9d9d9", padding: "4px 8px"}}>{pair.right}</td>
                        </tr>
                    ))}
                </table>
            </div>
        }
        return <FormattedQuestion question={props.question} answer={props.answer} max_width={425}/>
    }

    const view = selectedTab === EDIT ? editView :
        <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
            {previewBody()}
        </div>

    return (
        <Modal
            open={props.visible}
            onOk={props.save}
            title={props.title}
            onCancel={props.cancel}
            footer={props.footer}
            width="500px">

            <div style={{display: "flex", flexDirection: "column"}}>
                <span style={{display: "flex", marginBottom: 10}}>
    <Input autoFocus={!props.category} placeholder="Category" value={props.category}
           onClick={(event) => setFocusedInput(event as unknown as string)} id={CATEGORY}
           onChange={(event) => props.set_category(event.target.value)} onPressEnter={null as any}/>
                <ScoringNote scoring_note={props.scoring_note}
                             set_scoring_note={props.set_scoring_note}
                             set_scoring_note_was_cleared={props.set_scoring_note_was_cleared}
                />
                </span>

                <Radio.Group buttonStyle="solid" size="small"
                             value={questionType}
                             onChange={(event) => props.set_question_type?.(event.target.value)}
                             style={{marginBottom: 10}} disabled={props.disabled}>
                    <Radio.Button value={FREEFORM}> Freeform </Radio.Button>
                    <Radio.Button value={MULTIPLE_CHOICE}> Multiple choice </Radio.Button>
                    <Radio.Button value={MATCHING}> Matching </Radio.Button>
                </Radio.Group>

                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>

                            <Radio.Group buttonStyle="solid" onChange={(event) => setSelectedTab(event.target.value)}
                                         value={selectedTab}
                                         defaultValue={EDIT} size="small">
                                <Radio.Button key={EDIT} value={EDIT}> {EDIT} </Radio.Button>
                                <Radio.Button key={PREVIEW} value={PREVIEW}> {PREVIEW} </Radio.Button>
                            </Radio.Group>

                            <EditorToolbar wrap={wrap} wrap_line={wrap_line} insert={insert}/>
                        </span>

                {view}
            </div>
        </Modal>
    );

}

function wrapValue(value: string, fromIndex: number, toIndex: number, withValue: string) {
    return [value.slice(0, fromIndex),
        withValue, value.slice(fromIndex, toIndex), withValue,
        value.slice(toIndex)].join("")
}
