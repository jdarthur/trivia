import React from "react";
import {Spin} from "antd";
import {useAuth0} from "@auth0/auth0-react";

interface Props {
    token: string
    component: React.ReactNode
}

export default function AuthRequired(props: Props) {
    const {isLoading} = useAuth0()

    if (isLoading) {
        return <Spin/>
    }

    if (!props.token) {
        return <div style={{padding: 25}}>
            You must be logged in to access this page.
        </div>
    }

    // The wrapper is a flex child of the app's Content column; without these
    // it sizes to its content, breaking the height chain the editor list pages
    // rely on to bound the table and keep the pager in the viewport (#196).
    return (
        <div style={{display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0}}>
            {props.component}
        </div>
    );
};
