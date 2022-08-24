import React, {useState} from 'react';
import LoadingOrView from "../editor/LoadingOrView"
import Collection from "./Collection";
import NewCollection from "./NewCollection";
import NewButton from "../editor/NewButton";
import {useGetCollectionsQuery} from "../api/main";
import PageHeader from "../common/PageHeader";

export default function CollectionList() {

    const [modalOpen, setModalOpen] = useState(false)

    const {data, isLoading} = useGetCollectionsQuery()
    const c = data?.collections

    const newCollection = <NewCollection open={modalOpen} close={() => setModalOpen(false)}/>
    const newButton = <NewButton on_click={() => setModalOpen(true)}/>

    const collections = c?.map((collection) => (
        <Collection key={collection.id} id={collection.id} name={collection.name}
                    create_date={collection.create_date} questions={collection.questions} />))

    return <div style={{display: "flex", flexWrap: "wrap", margin: 10, alignItems: "center"}}>
        <div className="ql_and_filter">
            <PageHeader breadcrumbs={["Editor", "Collections"]} header={newButton} style={{marginBottom: 10}}/>
            <LoadingOrView class_name="round_list" loading={isLoading}
                           empty={c?.length === 0} loaded_view={collections} />
        </div>

        {newCollection}
    </div>

}