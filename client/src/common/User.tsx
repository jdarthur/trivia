import React from "react";

import {Popover} from 'antd'
import LogoutButton from "./Logout2";
import {useAuth0} from "@auth0/auth0-react";
import {MOCK_AVATAR, isMockMode} from "./mockUser";

interface Props {
    mockName?: string | null
}

const User = ({mockName}: Props) => {

    const {user} = useAuth0();
    const isMock = isMockMode();
    const name = isMock ? mockName : user?.name;
    const picture = isMock ? MOCK_AVATAR : user?.picture;

    const content = <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
        <LogoutButton mock={isMock}/>
    </div>

    return (
        <Popover content={content} title={name} trigger="click" placement="bottomRight">
            <img src={picture} alt={name ?? undefined} style={{width: 40, height: 40, cursor: 'pointer'}}/>
        </Popover>

    );
};

export default User;
