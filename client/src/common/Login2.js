import React from "react";
import {useAuth0} from "@auth0/auth0-react";
import {Button} from "antd"

import {UserOutlined} from "@ant-design/icons";

const LoginButton = () => {

    const {loginWithRedirect} = useAuth0();

    const login = async () => {
        console.log("about to log in from ", window.location.href)
        await loginWithRedirect({
            audience: "https://borttrivia.com/editor",
            scope: "openid profile email offline_access read:current_user",
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
