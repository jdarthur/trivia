import React from "react";

import { Popover } from 'antd'
import { useAuth0 } from "@auth0/auth0-react";
import LogoutButton from "./Logout2";

const User = () => {
    const { user } = useAuth0();
    const { name, picture, email } = user;

    console.log(user)

    const content = <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
        <LogoutButton />
    </div>

    return (
        <Popover content={content} title={name} trigger="click" placement="right">
            <img src={picture} alt={name} style={{ width: 40, height: 40, cursor: 'pointer' }} />
        </Popover>

    );
};

export default User;