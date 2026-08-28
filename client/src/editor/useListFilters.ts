import {useMemo, useState} from "react";
import {buildListQuery, type ListParams} from "../api/listParams";

/**
 * Filter + pagination state shared by the editor list pages (ticket #195/
 * #196). Owns the ListParams a page sends to the API and derives the query
 * string to pass to the RTK Query hook, so Questions / Rounds / Categories all
 * filter and page the same way.
 *
 * Changing any filter resets the page to 0: the filtered set is a different
 * set, so the page the user was on may not exist any more.
 */
export interface UseListFiltersOptions {
    /** Start with the unused-only filter on (the questions/rounds pages do). */
    unused_only?: boolean
    /** Records per page. */
    page_size?: number
}

export interface ListFilters {
    /** The serialized query string for the RTK Query hook ("" when unfiltered). */
    query: string
    unusedOnly: boolean
    textFilter: string
    page: number       // zero-based, as the API sees it
    pageSize: number
    /** Toggle unused_only (page resets to 0). */
    setUnusedOnly: (value: boolean) => void
    /** Set the search text (page resets to 0). */
    setTextFilter: (value: string) => void
    /** Jump to a page (zero-based). */
    setPage: (page: number) => void
    /** Change page size (page resets to 0). */
    setPageSize: (size: number) => void
}

export function useListFilters(options: UseListFiltersOptions = {}): ListFilters {
    const [params, setParamsState] = useState<ListParams>(() => ({
        unused_only: options.unused_only ?? false,
        text_filter: "",
        page: 0,
        page_size: options.page_size ?? 50,
    }))

    // A filter change invalidates the current page, so every setter below resets
    // it; setPage is the only one that moves the page.
    const query = useMemo(() => buildListQuery(params), [params])

    return {
        query,
        unusedOnly: !!params.unused_only,
        textFilter: params.text_filter || "",
        page: params.page || 0,
        pageSize: params.page_size || 50,
        setUnusedOnly: (value) => setParamsState({...params, unused_only: value, page: 0}),
        setTextFilter: (value) => setParamsState({...params, text_filter: value, page: 0}),
        setPage: (page) => setParamsState({...params, page}),
        setPageSize: (size) => setParamsState({...params, page_size: size, page: 0}),
    }
}
