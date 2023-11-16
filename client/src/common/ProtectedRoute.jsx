import React from 'react';
import { withAuthenticationRequired } from '@auth0/auth0-react';
import {Spin} from "antd";

export const ProtectedRoute = ({ component }) => {
    const Component = withAuthenticationRequired(component, {
        onRedirecting: () => (
            <div className="page-layout">
                <Spin size={"large"}/>
            </div>
        ),
    });

    return <Component />;
};
