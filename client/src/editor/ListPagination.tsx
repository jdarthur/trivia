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
 * Hidden for an empty list. It renders even when everything fits on one page:
 * the range readout ("1-12 of 12") is useful, and the page-size chooser has to
 * be reachable before the list outgrows a page — otherwise a user could never
 * ask for a smaller page.
 */
export default function ListPagination(props: Props) {
    const meta = props.meta
    if (!meta || meta.total === 0) {
        return null
    }

    return <div style={{display: "flex", justifyContent: "flex-end", padding: "10px 5px"}}>
        <Pagination
            current={props.page + 1}
            pageSize={props.pageSize}
            total={meta.total}
            showSizeChanger={!!props.set_page_size}
            pageSizeOptions={[10, 25, 50, 100]}
            // antd derives the range from current/pageSize, and `total` here is
            // the filtered count from the server (not dataSource.length), so the
            // readout describes the whole filtered set.
            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
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
