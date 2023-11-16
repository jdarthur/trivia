import React from "react";
import {Spin} from "antd";
import {useAuth0} from "@auth0/auth0-react";

export default function AuthRequired(props) {
    const {isLoading} = useAuth0()

    if (isLoading) {
        return <Spin/>
    }

    if (!props.token) {
        return <div style={{padding: 25}}>
            You must be logged in to access this page.
        </div>
    }

    return (
        <div>
            {props.component}
        </div>
    );
};

