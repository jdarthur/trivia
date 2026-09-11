import React from 'react';
import {useAllCategories} from "../api/main";
import ScoringNoteRenderInList from "../question/ScoringNoteRenderInList";
import {Spin} from "antd";

interface Props {
    id: string
    // Render the category's scoring note as an info icon (question list).
    show_note?: boolean
}

/**
 * Resolves a question's category ID to its display name (ticket #180: the
 * question wire format carries the category ID, not the name). Falls back to
 * the raw ID when the category can't be found (e.g. it was deleted since the
 * question was fetched) so nothing renders as a blank. While the categories
 * list is still loading, show a small spinner instead of the raw ID, which is
 * meaningless to a user.
 */
export default function CategoryName({id, show_note}: Props) {
    const {data: categories, isLoading} = useAllCategories()
    const category = (categories || []).find(c => c.id === id)

    // The categories list hasn't arrived yet — show a spinner rather than the
    // raw category ID (which is meaningless to a user).
    if (isLoading) {
        return <Spin size="small"/>
    }

    if (!category) {
        return <span>{id}</span>
    }

    return <span style={{display: "flex", alignItems: "center"}}>
        {category.name}
        {show_note && category.scoring_note ?
            <ScoringNoteRenderInList id={category.scoring_note}/> : null}
    </span>
}
