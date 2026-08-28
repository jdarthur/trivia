import React from 'react';
import {useAllCategories} from "../api/main";
import ScoringNoteRenderInList from "../question/ScoringNoteRenderInList";

interface Props {
    id: string
    // Render the category's scoring note as an info icon (question list).
    show_note?: boolean
}

/**
 * Resolves a question's category ID to its display name (ticket #180: the
 * question wire format carries the category ID, not the name). Falls back to
 * the raw ID when the category can't be found (e.g. it was deleted since the
 * question was fetched) so nothing renders as a blank.
 */
export default function CategoryName({id, show_note}: Props) {
    const {data: categories} = useAllCategories()
    const category = (categories || []).find(c => c.id === id)

    if (!category) {
        return <span>{id}</span>
    }

    return <span style={{display: "flex", alignItems: "center"}}>
        {category.name}
        {show_note && category.scoring_note ?
            <ScoringNoteRenderInList id={category.scoring_note}/> : null}
    </span>
}
