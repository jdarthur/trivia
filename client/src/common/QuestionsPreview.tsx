import React from 'react';
import {Popover, Tag, Typography} from "antd";
import {Link, useSearchParams} from "react-router";
import type {Question} from "../types/models";

interface Props {
    /**
     * The questions to list inside the popover, already filtered to the ones
     * behind this count (category questions / round questions).
     */
    questions: Question[]
    /**
     * The number shown on the Tag. Defaults to questions.length; pass an
     * explicit server-derived count (e.g. category.questions_used) so the Tag
     * stays accurate even before the questions list has loaded.
     */
    count?: number
}

/**
 * The clickable "N questions" count Tag (ticket #272). Clicking it opens a
 * Popover listing an abbreviated question/answer preview for each question, so
 * an editor can scan what sits behind a count without opening each one. Shared
 * by the Categories and Rounds tables.
 */
export default function QuestionsPreview({questions, count}: Props) {
    const n = count ?? questions.length
    const label = n === 1 ? "1 question" : `${n} questions`

    // Ticket #274: each preview links to the question editor, deep-linked to
    // that question. The `mockUser` param is carried forward so the dev-mode
    // login survives a fresh load of the questions page.
    const [params] = useSearchParams()
    const mockUser = params.get("mockUser")

    const content = (
        <div style={{maxWidth: 360}}>
            {questions.length === 0
                ? <Typography.Text type="secondary">No questions</Typography.Text>
                : questions.map(q => {
                    const query = `question=${q.id}` + (mockUser ? `&mockUser=${mockUser}` : "")
                    return (
                        <div key={q.id} style={{marginBottom: 10}}>
                            <Typography.Paragraph
                                ellipsis={{rows: 2, expandable: false, symbol: "…"}}
                                style={{fontWeight: 600, marginBottom: 0}}
                            >
                                <Link to={`/questions?${query}`}>{q.question}</Link>
                            </Typography.Paragraph>
                            <Typography.Paragraph
                                ellipsis={{rows: 2, expandable: false, symbol: "…"}}
                                style={{color: "rgba(0, 0, 0, 0.65)", marginBottom: 0}}
                            >
                                {q.answer}
                            </Typography.Paragraph>
                        </div>
                    )
                })}
        </div>
    )

    return <Popover content={content} title={label} placement="right">
        <Tag color={n ? "blue" : undefined} style={{cursor: "pointer"}}>
            {label}
        </Tag>
    </Popover>
}
