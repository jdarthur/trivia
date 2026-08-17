import React from 'react';
import {createRoot} from 'react-dom/client';
import {Auth0Provider} from "@auth0/auth0-react";
import App from './common/App.jsx';

import {store, history} from './api/store';
import {Provider} from "react-redux";
import {AUDIENCE, SCOPE} from "./common/authConfig";

function redirectCallBack(appState) {
    if (appState?.returnTo) {
        history.replace((appState && appState.returnTo) || window.location.pathname);
    }
}

createRoot(document.getElementById('root')).render(
    <Auth0Provider
        domain="borttrivia.us.auth0.com"
        clientId="03cLv60jN7hC79K8oUXHDF1wsenRTMx5"
        useRefreshTokens={true}
        // Leave the iframe fallback off: it needs a third-party cookie on the
        // Auth0 domain, which Safari/Firefox/Brave block. With offline_access
        // requested below we have a real refresh token and don't need it.
        useRefreshTokensFallback={false}
        cacheLocation="localstorage"
        onRedirectCallback={redirectCallBack}
        authorizationParams={{
            redirect_uri: window.location.origin,
            audience: AUDIENCE,
            scope: SCOPE,
        }}>
        <Provider store={store}>
            <App/>
        </Provider>
    </Auth0Provider>
);

let vh = window.innerHeight * 0.01;
// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

window.addEventListener('resize', () => {
    // We execute the same script as before
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
});

const sendData = async function sendData(url, method, data) {
    let body
    if (data !== undefined) {
        const copy = Object.assign({}, data)
        delete copy.id
        delete copy.create_date
        body = JSON.stringify(copy)
    }

    const response = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: body
    })
    return response.json()
}

export default sendData