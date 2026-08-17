import React from "react";
import {useAuth0} from "@auth0/auth0-react";
import {Button} from "antd"

import {UserOutlined} from "@ant-design/icons";

const LoginButton = () => {

    const {loginWithRedirect} = useAuth0();

    const login = async () => {
        // audience/scope are inherited from the Auth0Provider's
        // authorizationParams, so they don't need to be repeated here.
        await loginWithRedirect({
            appState: {
                returnTo: window.location.href,
            }
        })
    }

    return (
        <Button type="primary" style={{paddingLeft: 10, paddingRight: 10}}
                onClick={login}>
            <span>
                <UserOutlined style={{marginRight: 5}}/>
                Log In
            </span>
        </Button>
    );
};

export default LoginButton;
