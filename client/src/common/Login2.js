import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "antd"

import { UserOutlined } from "@ant-design/icons";

const LoginButton = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <Button type="primary" style={{ paddingLeft: 10, paddingRight: 10 }} onClick={() => { loginWithRedirect() }}>
            <span>
                <UserOutlined style={{marginRight: 5}}/>
                Log In
            </span>
        </Button>
    );
};

export default LoginButton;
