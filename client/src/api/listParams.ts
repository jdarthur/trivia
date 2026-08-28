/**
 * Shared list query params for the editor list endpoints (ticket #195).
 *
 * The API understands one set of filtering/pagination params across
 * /editor/questions, /editor/rounds, /editor/categories, /editor/games and
 * /editor/collections; this module is the client-side counterpart so the three
 * list pages build the same query string instead of each hand-rolling one.
 */
export interface ListParams {
    /** Only records nothing else references (question→rounds, round→games, category→questions). */
    unused_only?: boolean
    /** Case-insensitive substring match. */
    text_filter?: string
    /** Columns text_filter searches; defaults per table server-side. */
    search_columns?: string[]
    /** Column to sort by; prefix with "-" for descending. */
    sort?: string
    /** Sort direction; an explicit "-" on sort wins over this. */
    order?: "asc" | "desc"
    /** Zero-based page index. */
    page?: number
    /** Records per page; omit for the whole (unpaginated) list. */
    page_size?: number
}

/**
 * Serialize ListParams into a query string, leading "?" included, or "" when
 * there is nothing to send (so it can be appended straight onto a URL).
 * Empty/false/undefined values are omitted: the API's defaults are "no filter"
 * and "no pagination", so sending nothing is the same as sending the default
 * and keeps the cache key stable.
 */
export function buildListQuery(params: ListParams = {}): string {
    const pairs: string[] = []

    if (params.unused_only) {
        pairs.push("unused_only=true")
    }
    if (params.text_filter) {
        pairs.push("text_filter=" + encodeURIComponent(params.text_filter))
    }
    if (params.search_columns?.length) {
        pairs.push("search_columns=" + params.search_columns.map(encodeURIComponent).join(","))
    }
    if (params.sort) {
        pairs.push("sort=" + encodeURIComponent(params.sort))
    }
    if (params.order) {
        pairs.push("order=" + params.order)
    }
    if (params.page) {
        pairs.push("page=" + params.page)
    }
    if (params.page_size) {
        pairs.push("page_size=" + params.page_size)
    }

    return pairs.length ? "?" + pairs.join("&") : ""
}

/** The pagination metadata every list endpoint returns alongside its records. */
export interface ListMeta {
    total: number
    page: number
    page_size: number
    total_pages: number
}
