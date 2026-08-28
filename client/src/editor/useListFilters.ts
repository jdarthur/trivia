import {useCallback, useEffect, useMemo, useState} from "react";
import {buildListQuery, type ListMeta, type ListParams} from "../api/listParams";

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
    const [params, setParams] = useState<ListParams>(() => ({
        unused_only: options.unused_only ?? false,
        text_filter: "",
        page: 0,
        page_size: options.page_size ?? 50,
    }))

    // Each setter updates from the previous state rather than a captured copy,
    // so two updates landed in the same tick both take effect. useCallback keeps
    // the identities stable so consumers (and the clamp effect below) don't see
    // a new function on every render.
    const patch = useCallback((changes: Partial<ListParams>, resetPage: boolean) => {
        setParams((previous) => ({
            ...previous,
            ...changes,
            ...(resetPage ? {page: 0} : {}),
        }))
    }, [])

    const setUnusedOnly = useCallback((value: boolean) => patch({unused_only: value}, true), [patch])
    const setTextFilter = useCallback((value: string) => patch({text_filter: value}, true), [patch])
    const setPage = useCallback((page: number) => patch({page}, false), [patch])
    const setPageSize = useCallback((size: number) => patch({page_size: size}, true), [patch])

    const query = useMemo(() => buildListQuery(params), [params])

    return {
        query,
        unusedOnly: !!params.unused_only,
        textFilter: params.text_filter || "",
        page: params.page || 0,
        pageSize: params.page_size || 50,
        setUnusedOnly,
        setTextFilter,
        setPage,
        setPageSize,
    }
}

/**
 * Return to the first page when the server's response says the current page no
 * longer exists — after deleting the last records, a filter change, or a page
 * number that outruns the data. Without this a user can land on an empty list
 * whose pager offers no page to click back to.
 *
 * Pages call this with the metadata their list query returned.
 */
export function useClampToFirstPage(meta: ListMeta | undefined, page: number, setPage: (page: number) => void) {
    useEffect(() => {
        if (meta && page > 0 && page >= meta.total_pages) {
            setPage(0)
        }
    }, [meta, page, setPage])
}
