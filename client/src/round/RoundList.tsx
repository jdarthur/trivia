import React, {useState} from 'react';
import {Table, Tag} from "antd";
import {EditOutlined} from '@ant-design/icons';
import LoadingOrView from "../editor/LoadingOrView";
import NewButton from "../editor/NewButton";
import DeleteConfirm from "../editor/DeleteConfirm";
import EditorFilter from "../editor/EditorFilter";
import ListPagination from "../editor/ListPagination";
import PageHeader from "../common/PageHeader";
import RoundModal from "./RoundModal";
import {useDeleteRoundMutation, useGetRoundsQuery} from "../api/main";
import {useClampToFirstPage, useListFilters} from "../editor/useListFilters";
import notify, {errorMessage} from "../common/notify";
import type {Round} from "../types/models";

interface Props {
    token?: string
}

/**
 * Rounds editor page (ticket #199): the rounds list is a table (Name, a concise
 * wager overview, and the number of questions), and editing happens in a single
 * multi-step modal (RoundModal) instead of the old card + sidebar layout.
 *
 * The shared filter/pagination controls (ticket #196) behave like the other
 * editor lists: search by name and an unused-only toggle (a round is unused
 * when no game contains it — the server computes that).
 */
export default function RoundList(props: Props) {

    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<Round | null>(null)

    const filters = useListFilters({unused_only: true, page_size: 25})
    const {data, isLoading} = useGetRoundsQuery(filters.query)
    const rounds = data?.rounds
    useClampToFirstPage(data, filters.page, filters.setPage)

    const [deleteRound] = useDeleteRoundMutation()

    const del = async (round: Round) => {
        const response = await deleteRound(round.id)
        if (response.error) {
            const desc = errorMessage("delete", "round", response.error)
            notify(false, desc)
        } else {
            notify(true, `Successfully deleted round`)
        }
    }

    const openCreate = () => {
        setEditing(null)
        setModalOpen(true)
    }

    const openEdit = (round: Round) => {
        setEditing(round)
        setModalOpen(true)
    }

    const delete_edit = (text: any, round: Round) => <span style={{fontSize: '1.2em'}}>
            <DeleteConfirm delete={() => del(round)} style={{paddingRight: 10}}/>
            <EditOutlined onClick={() => openEdit(round)}/>
        </span>

    // A concise wager overview: the distinct wager values in the round, sorted.
    // Wagers are usually the default 1/2/3 repeating set, so dedupe them.
    const wager_overview = (text: any, round: Round) => {
        const values = [...new Set(round.wagers || [])].sort((a, b) => a - b)
        return values.length > 0 ? values.join(", ") : "—"
    }

    const questions_tag = (text: any, round: Round) => <Tag color={round.questions?.length ? "blue" : undefined}>
            {round.questions?.length === 1 ? "1 question" : `${round.questions?.length || 0} questions`}
        </Tag>

    const columns = [
        {title: "", render: delete_edit, width: '5em'},
        {title: 'Name', dataIndex: 'name', ellipsis: {showTitle: false}},
        {title: 'Wagers', render: wager_overview, ellipsis: {showTitle: false}},
        {title: 'Questions', render: questions_tag}
    ]

    const newButton = <NewButton on_click={openCreate}/>

    const header = <EditorFilter set_text_filter={filters.setTextFilter} set_unused_only={filters.setUnusedOnly}
                                 data_type="rounds" text_filter={filters.textFilter}
                                 unused_only={filters.unusedOnly} add_button={newButton}/>

    const modal = <RoundModal visible={modalOpen} setVisible={setModalOpen} round={editing}/>

    const table_and_pager = <div>
        <Table columns={columns} dataSource={rounds} pagination={false}
               size="small" style={{maxWidth: 1500}} rowKey="id"/>
        <ListPagination meta={data} page={filters.page} pageSize={filters.pageSize}
                        set_page={filters.setPage} set_page_size={filters.setPageSize}/>
    </div>

    return <div className="ql_and_filter">
        <PageHeader breadcrumbs={["Editor", "Rounds"]} header={header} style={{marginBottom: 10}}/>
        <LoadingOrView class_name="round_list" loading={isLoading}
                       empty={rounds?.length === 0} loaded_view={table_and_pager}/>
        {modal}
    </div>
}
