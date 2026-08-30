import React from "react";
import {Pagination} from "antd";
import type {ListMeta} from "../api/listParams";

interface Props {
    /** The pagination metadata returned by the list endpoint. */
    meta?: ListMeta
    /** Zero-based page index, as the API sees it (antd pages are 1-based). */
    page: number
    pageSize: number
    /** Jump to a zero-based page. */
    set_page: (page: number) => void
    set_page_size?: (size: number) => void
}

/**
 * Server-side pagination control for the editor list pages (ticket #195).
 * Unlike antd's built-in Table pagination — which slices the rows it already
 * has — this drives the API's page/page_size params: the server returns one
 * page plus the total for the *filtered* set, so the counts here describe what
 * the user actually filtered on.
 *
 * Hidden for an empty list — except when the user is on a later page, where it
 * stays so they can get back: deleting the last record on page 3 would otherwise
 * leave an empty list with no control to return to page 1. It also renders when
 * everything fits on one page, since the range readout ("1-12 of 12") is useful
 * and the page-size chooser has to be reachable before a list outgrows a page.
 */
export default function ListPagination(props: Props) {
    const meta = props.meta
    if (!meta || (meta.total === 0 && props.page === 0)) {
        return null
    }

    const rangeStart = meta.total === 0 ? 0 : meta.page * props.pageSize + 1
    const rangeEnd = Math.min((meta.page + 1) * props.pageSize, meta.total)

    return <div className="list-pagination">
        <Pagination
            current={props.page + 1}
            pageSize={props.pageSize}
            total={meta.total}
            showSizeChanger={!!props.set_page_size}
            pageSizeOptions={[10, 25, 50, 100]}
            // The range comes from the server's page/page_size and the filtered
            // total, not from dataSource.length, so it describes the whole
            // filtered set rather than just the rows mounted.
            showTotal={() => `${rangeStart}-${rangeEnd} of ${meta.total}`}
            onChange={(nextPage, nextSize) => {
                if (nextSize && nextSize !== props.pageSize && props.set_page_size) {
                    props.set_page_size(nextSize)
                    return
                }
                props.set_page(nextPage - 1)
            }}
            size="small"/>
    </div>
}
