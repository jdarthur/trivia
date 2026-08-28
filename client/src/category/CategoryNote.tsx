import React from 'react';
import {useAllCategories, useGetScoringNotesQuery} from "../api/main";

interface Props {
    id: string
}

/**
 * The scoring note of a category, display-only (ticket #180, D2): the note
 * lives on the category, so it resolves through category.scoring_note → note
 * description and is no longer editable on the question itself.
 */
export default function CategoryNote({id}: Props) {
    const {data: categories} = useAllCategories()
    const {data: notes} = useGetScoringNotesQuery()
    const category = (categories || []).find(c => c.id === id)
    const note = (notes || []).find(n => n.id === category?.scoring_note)

    if (!note?.description) {
        return null
    }

    return <div style={{marginBottom: 10, color: "#8c8c8c"}}>
        Note: {note.description}
    </div>
}
