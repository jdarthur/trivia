import React, {useEffect, useState} from 'react';
import './Question.css';

import {Input, Modal, Radio, Button, Select, Steps, Popconfirm, Tooltip} from 'antd';
import {ContainerOutlined, EditOutlined, ExclamationCircleOutlined, MinusCircleOutlined, OrderedListOutlined, SortAscendingOutlined, SwapOutlined} from '@ant-design/icons';
import QuestionBody from "./QuestionBody"
import EditorToolbar from "./EditorToolbar";
import {ANSWER, CATEGORY, QUESTION} from "./EditQuestionController";
import CategorySelect from "../category/CategorySelect";
import CategoryNote from "../category/CategoryNote";
import type {QuestionBucket, QuestionBucketItem, QuestionChoice, QuestionOrderedItem, QuestionPair} from "../types/models";

const {TextArea} = Input;

const EDIT = "Edit"
const PREVIEW = "Preview"

const FREEFORM = "freeform"
const MULTIPLE_CHOICE = "multiple_choice"
const MATCHING = "matching"
const BUCKETING = "bucketing"
const ORDERING = "ordering"

// Ticket #166: the three steps of the multi-step question editor.
const STEP_BASIC = 0
export const STEP_EDITOR = 1
const STEP_PREVIEW = 2
export const STEP_COUNT = 3

// Per-type icon + short description used by the question-type selector.
const QUESTION_TYPES = [
    {value: FREEFORM, icon: <EditOutlined/>, label: "Freeform",
     description: "Players type their own answer, which is compared against your answer."},
    {value: MULTIPLE_CHOICE, icon: <OrderedListOutlined/>, label: "Multiple choice",
     description: "Players pick one answer from a list of options; you mark the correct one."},
    {value: MATCHING, icon: <SwapOutlined/>, label: "Matching",
     description: "Players match each item on the left with its correct partner on the right."},
    {value: BUCKETING, icon: <ContainerOutlined/>, label: "Bucketing",
     description: "Players sort each item into the bucket it belongs to."},
    {value: ORDERING, icon: <SortAscendingOutlined/>, label: "Ordering",
     description: "Players put the items in the correct order; the order you list them is the answer key."},
]

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
    footer: React.ReactNode
    set_category: (value: string) => void
    set_question: (value: string) => void
    set_answer: (value: string) => void
    initialValues?: any
    question_type?: string
    set_question_type?: (value: string) => void
    choices?: QuestionChoice[]
    set_choices?: (choices: QuestionChoice[]) => void
    pairs?: QuestionPair[]
    set_pairs?: (pairs: QuestionPair[]) => void
    buckets?: QuestionBucket[]
    set_buckets?: (buckets: QuestionBucket[]) => void
    items?: QuestionBucketItem[]
    set_items?: (items: QuestionBucketItem[]) => void
    // Ticket #213: ordering — the author's entry order is the correct order.
    ordered?: QuestionOrderedItem[]
    set_ordered?: (ordered: QuestionOrderedItem[]) => void
    disabled?: boolean
    // Ticket #166: opt into the three-step <Steps /> flow. When false/omitted
    // (e.g. the live in-game hot-edit), the legacy single-view modal renders.
    steps?: boolean
    step?: number
    // Validation message for the current step (e.g. "Please select a correct
    // answer"); rendered above the form in the Question step when non-empty.
    step_error?: string
    // Ticket #184: when set (gameplay hot-edit), replaces the category
    // selector with this read-only note — the mod page is anonymous or the
    // snapshot's category no longer matches any of the user's categories, so
    // the category cannot be changed here (it is preserved on save).
    category_note?: string
}

export default function EditQuestionModal(props: Props) {

    const [selectedTab, setSelectedTab] = useState(EDIT)
    const [focusedInput, setFocusedInput] = useState(CATEGORY)
    const [confirmTypeChange, setConfirmTypeChange] = useState(false)
    const [pendingType, setPendingType] = useState<string | null>(null)
    // Preview: by default show the question as players will see it (no answer,
    // no grading); "Show answer" reveals the scored in-game view.
    const [showAnswer, setShowAnswer] = useState(false)

    // Ticket #166: reset to the first step whenever the modal is (re)opened so
    // the editor always starts at "Basic info".
    useEffect(() => {
        if (props.visible) {
            setConfirmTypeChange(false)
            setPendingType(null)
            setShowAnswer(false)
        }
    }, [props.visible])

    const questionType = props.question_type || FREEFORM

    // Ticket #166: changing the question type clears the question + answer (and
    // the structured sub-data), but only after the user confirms via the
    // Popconfirm tooltip when there is actually content to lose. With an empty
    // question there is nothing to reset, so the type changes immediately.
    const hasQuestionContent = () => {
        return props.question.trim() !== "" || props.answer.trim() !== ""
            || (props.choices || []).some(choice => choice.text.trim() !== "")
            || (props.pairs || []).some(pair => pair.left.trim() !== "" || pair.right.trim() !== "")
            || (props.buckets || []).some(bucket => bucket.text.trim() !== "")
            || (props.items || []).some(item => item.text.trim() !== "")
            || (props.ordered || []).some(item => item.text.trim() !== "")
    }

    const requestTypeChange = (value: string) => {
        if (value === questionType) {
            return
        }
        if (!hasQuestionContent()) {
            props.set_question_type?.(value)
            return
        }
        setPendingType(value)
        setConfirmTypeChange(true)
    }

    const clearQuestionAndAnswer = () => {
        props.set_question("")
        props.set_answer("")
        props.set_choices?.([])
        props.set_pairs?.([])
        props.set_buckets?.([])
        props.set_items?.([])
        props.set_ordered?.([])
    }

    const applyTypeChange = () => {
        if (pendingType) {
            clearQuestionAndAnswer()
            props.set_question_type?.(pendingType)
        }
        setPendingType(null)
        setConfirmTypeChange(false)
    }

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

    const set_bucket_text = (index: number, value: string) => {
        const next = (props.buckets || []).map((bucket, i) => i === index ? {...bucket, text: value} : bucket)
        props.set_buckets?.(next)
    }

    const add_bucket = () => {
        props.set_buckets?.([...(props.buckets || []), {text: ""}])
    }

    const remove_bucket = (index: number) => {
        props.set_buckets?.((props.buckets || []).filter((_, i) => i !== index))
    }

    const set_item_text = (index: number, value: string) => {
        const next = (props.items || []).map((item, i) => i === index ? {...item, text: value} : item)
        props.set_items?.(next)
    }

    const set_item_bucket = (index: number, value: string) => {
        const next = (props.items || []).map((item, i) => i === index ? {...item, bucket: value} : item)
        props.set_items?.(next)
    }

    const add_item = () => {
        props.set_items?.([...(props.items || []), {text: "", bucket: ""}])
    }

    const remove_item = (index: number) => {
        props.set_items?.((props.items || []).filter((_, i) => i !== index))
    }

    // Ticket #213: ordering — rows are numbered 1..n and their entry order IS
    // the correct order, so there is no correctness toggle, just text rows.
    const set_ordered_text = (index: number, value: string) => {
        const next = (props.ordered || []).map((item, i) => i === index ? {...item, text: value} : item)
        props.set_ordered?.(next)
    }

    const add_ordered = () => {
        props.set_ordered?.([...(props.ordered || []), {text: ""}])
    }

    const remove_ordered = (index: number) => {
        props.set_ordered?.((props.ordered || []).filter((_, i) => i !== index))
    }

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

    // bucketing (ticket #164): define the bucket list, then each item with the
    // bucket it correctly belongs to.
    const bucketsView = <div>
        <TextArea autoFocus={!!props.category} placeholder="Question" value={props.question}
                  style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                  onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                  onPressEnter={null as any}/>

        {structuredNote}
        <div style={{marginBottom: 10}}>
            <div style={{fontWeight: 600, marginBottom: 4}}>Buckets</div>
            {(props.buckets || []).map((bucket, index) => (
                <div key={index} style={{display: "flex", alignItems: "center", marginBottom: 6}}>
                    <Input placeholder="Bucket" value={bucket.text} style={{flexGrow: 1}} disabled={props.disabled}
                           onChange={(event) => set_bucket_text(index, event.target.value)}/>
                    <MinusCircleOutlined onClick={() => remove_bucket(index)} disabled={props.disabled}
                                         style={{marginLeft: 8, cursor: "pointer"}}/>
                </div>
            ))}
            <Button size="small" type="dashed" onClick={add_bucket} disabled={props.disabled}> Add bucket </Button>
        </div>
        <div style={{marginBottom: 10}}>
            <div style={{fontWeight: 600, marginBottom: 4}}>Items</div>
            {(props.items || []).map((item, index) => (
                <div key={index} style={{display: "flex", alignItems: "center", marginBottom: 6}}>
                    <Input placeholder="Item" value={item.text} style={{flexGrow: 1, marginRight: 6}} disabled={props.disabled}
                           onChange={(event) => set_item_text(index, event.target.value)}/>
                    <Select placeholder="Bucket" style={{width: 160}} value={item.bucket || undefined}
                            disabled={props.disabled}
                            onChange={(value) => set_item_bucket(index, value)}
                            options={(props.buckets || []).map(bucket => ({value: bucket.text, label: bucket.text}))}/>
                    <MinusCircleOutlined onClick={() => remove_item(index)} disabled={props.disabled}
                                         style={{marginLeft: 8, cursor: "pointer"}}/>
                </div>
            ))}
            <Button size="small" type="dashed" onClick={add_item} disabled={props.disabled}> Add item </Button>
        </div>
    </div>

    // ordering (ticket #213): a numbered list of items in the author's order —
    // that entry order is the correct order (the answer key). The position
    // number is rendered explicitly (index + 1) so it shows regardless of CSS
    // list-marker behavior on the flex rows.
    const orderedView = <div>
        <TextArea autoFocus={!!props.category} placeholder="Question" value={props.question}
                  style={{marginBottom: 10}} id={QUESTION} onClick={() => setFocusedInput(QUESTION)}
                  onChange={(event) => props.set_question(event.target.value)} autoSize={{minRows: 4}}
                  onPressEnter={null as any}/>

        {structuredNote}
        <div style={{marginBottom: 10}}>
            <div style={{fontWeight: 600, marginBottom: 4}}>Ordered items (first = correct first)</div>
            {(props.ordered || []).map((item, index) => (
                <div key={index} style={{display: "flex", alignItems: "center", marginBottom: 6}}>
                    <span style={{width: 22, flexShrink: 0}}>{index + 1}.</span>
                    <Input placeholder="Item" value={item.text} style={{flexGrow: 1}} disabled={props.disabled}
                           onChange={(event) => set_ordered_text(index, event.target.value)}/>
                    <MinusCircleOutlined onClick={() => remove_ordered(index)} disabled={props.disabled}
                                         style={{marginLeft: 8, cursor: "pointer"}}/>
                </div>
            ))}
            <Button size="small" type="dashed" onClick={add_ordered} disabled={props.disabled}> Add item </Button>
        </div>
    </div>

    const editView = questionType === MULTIPLE_CHOICE ? choicesView :
        questionType === MATCHING ? pairsView :
        questionType === BUCKETING ? bucketsView :
        questionType === ORDERING ? orderedView : freeformView

    // The preview shows the question as it will appear to players (no answer,
    // no grading), with a "Show answer" toggle that reveals the scored in-game
    // view — ✅/❌ on multiple-choice options, the answer line for freeform.
    // For matching/bucketing/ordering the structured lists themselves are the
    // answer key, so they render unchanged. Rendered via the same QuestionBody
    // the editor's read-only question cards use, so the preview can't drift
    // from the in-game look.
    const previewBody = () => {
        return <div>
            <QuestionBody question={props.question}
                          answer={props.answer}
                          question_type={questionType}
                          choices={props.choices}
                          pairs={props.pairs}
                          buckets={props.buckets}
                          items={props.items}
                          ordered={props.ordered}
                          max_width={425}
                          scored={showAnswer}
                          show_answer={showAnswer}/>
            <div style={{marginTop: 8}}>
                <a onClick={() => setShowAnswer(!showAnswer)} style={{fontSize: 12}}>
                    {showAnswer ? "Hide answer" : "Show answer"}
                </a>
            </div>
        </div>
    }

    const view = selectedTab === EDIT ? editView :
        <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
            {previewBody()}
        </div>

    // Ticket #166: the three-step flow. Step 1 = basic info, step 2 = question
    // editor (question box, editor tools, answer box), step 3 = preview. The
    // Submit button only appears on the last step (see EditQuestionController's
    // footer).
    const step = props.step ?? STEP_BASIC
    const typeRadio = (
        <Radio.Group value={questionType}
                     onChange={(event) => props.steps ? requestTypeChange(event.target.value) : props.set_question_type?.(event.target.value)}
                     style={{display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 10}}
                     disabled={props.disabled}>
            {QUESTION_TYPES.map(type => (
                <Tooltip key={type.value} title={type.description}>
                    <Radio value={type.value} style={{marginRight: 0, marginBottom: 6}}>
                        {type.icon} <span style={{marginLeft: 6}}>{type.label}</span>
                    </Radio>
                </Tooltip>
            ))}
        </Radio.Group>
    )

    const basicStep = <div>
        <span style={{display: "flex", marginBottom: 10}}>
            <CategorySelect category={props.category} set_category={props.set_category}/>
        </span>
        <CategoryNote id={props.category}/>
        <div style={{fontWeight: 600, marginBottom: 4}}>Question type</div>
        {props.steps ? (
            <Popconfirm open={confirmTypeChange}
                        title="Changing the question type clears the question and answer. Are you sure?"
                        okText="Change" cancelText="Cancel"
                        onConfirm={applyTypeChange} onCancel={() => {setConfirmTypeChange(false); setPendingType(null)}}>
                {typeRadio}
            </Popconfirm>
        ) : typeRadio}
    </div>

    const stepsView = (
        <div style={{display: "flex", flexDirection: "column"}}>
            <Steps size="small" current={step} style={{marginBottom: 20}}
                   items={[{title: "Basic info"}, {title: "Question"}, {title: "Preview"}]}/>
            {step === STEP_BASIC ? basicStep :
                step === STEP_EDITOR ? (
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <span style={{display: "flex", justifyContent: "flex-start", marginBottom: 10}}>
                            <EditorToolbar wrap={wrap} wrap_line={wrap_line} insert={insert}/>
                        </span>
                        {props.step_error ? (
                            <div style={{display: "flex", alignItems: "center", color: "#ff4d4f", marginBottom: 10}}>
                                <ExclamationCircleOutlined style={{marginRight: 6}}/>
                                {props.step_error}
                            </div>
                        ) : null}
                        {editView}
                    </div>
                ) : (
                    <div style={{border: '1px solid #d9d9d9', borderRadius: 2, padding: 10}}>
                        {previewBody()}
                    </div>
                )}
        </div>
    )

    const body = props.steps ? stepsView : (
        <div style={{display: "flex", flexDirection: "column"}}>
            <span style={{display: "flex", marginBottom: 10}}>
                {props.category_note ? (
                    <span style={{color: "#8c8c8c"}}>{props.category_note}</span>
                ) : (
                    <CategorySelect category={props.category} set_category={props.set_category}/>
                )}
            </span>
            {props.category_note ? null : <CategoryNote id={props.category}/>}

            {typeRadio}

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
    )

    return (
        <Modal
            open={props.visible}
            onOk={props.save}
            title={props.title}
            onCancel={props.cancel}
            footer={props.footer}
            width="500px">
            {body}
        </Modal>
    );

}

function wrapValue(value: string, fromIndex: number, toIndex: number, withValue: string) {
    return [value.slice(0, fromIndex),
        withValue, value.slice(fromIndex, toIndex), withValue,
        value.slice(toIndex)].join("")
}
