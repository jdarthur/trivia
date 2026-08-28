import React, {lazy, Suspense, useEffect, useState} from 'react';
import {Link, Outlet, Route, Routes} from "react-router";

import HomePage from "../homepage/Homepage"

import './App.css';
import logo from "./borttrivia.png"

import 'antd/dist/reset.css';
import {Layout, Menu, Spin} from 'antd';
import {FormOutlined} from '@ant-design/icons';
import {useAuth0} from "@auth0/auth0-react";
import {useDispatch} from "react-redux";
import {setToken as setAuthToken, logoutUser} from "../api/auth";
import AuthButton from "./AuthButton";
import {HistoryRouter} from "redux-first-history/rr6";
import {history} from "../api/store";
import AuthRequired from "./AuthRequired";
import {AUDIENCE, SCOPE} from "./authConfig";
import {buildMockToken, getMockUserName} from "./mockUser";

const {Content, Header} = Layout;
const {SubMenu} = Menu;

const QUESTION = "Questions"
const ROUND = "Rounds"
const GAME = "Games"
const COLLECTION = "Collections"
const CATEGORY = "Categories"

// Editor lists are lazy-loaded so anonymous players (who only ever hit "/")
// don't download the editor bundle. Each is fetched on first navigation to its
// route. See ticket #65.
const QuestionList = lazy(() => import("../question/QuestionList"));
const RoundList = lazy(() => import("../round/RoundList"));
const GameList = lazy(() => import("../game/GameList"));
const CollectionList = lazy(() => import("../collections/CollectionList"));
const CategoryList = lazy(() => import("../category/CategoryList"));

function RouteFallback() {
    return <div style={{display: "flex", justifyContent: "center", padding: "3rem"}}><Spin/></div>;
}

export default function App() {

    const [token, setToken] = useState("")
    const [inGame, setInGame] = useState(false)
    const [isMod, setIsMod] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const {getAccessTokenSilently, isAuthenticated, isLoading: authIsLoading} = useAuth0();
    const dispatch = useDispatch();

    useEffect(() => {
        const is_mobile = window.matchMedia("only screen and (max-width: 760px)").matches;
        setIsMobile(is_mobile)
    }, []);

    useEffect(() => {
        // Mock mode: a ?mockUser=<name> URL param logs in as a seeded dev-mode
        // user without Auth0. Build an unsigned token for the dev backend and
        // skip the Auth0 token fetch entirely.
        const mockUser = getMockUserName();
        if (mockUser) {
            const authToken = buildMockToken(mockUser);
            setToken(authToken);
            dispatch(setAuthToken({authToken}));
            return
        }

        // Wait for the SDK to finish handling the redirect callback, otherwise
        // we ask for a token before there is a session to get one from.
        if (authIsLoading) {
            return
        }

        // Not logged in: make sure we aren't holding a token that redux-persist
        // rehydrated from a previous session, or every request 401s.
        if (!isAuthenticated) {
            setToken("")
            dispatch(logoutUser())
            return
        }

        const getEditorJwt = async () => {
            try {
                const authToken = await getAccessTokenSilently({
                    authorizationParams: {audience: AUDIENCE, scope: SCOPE}
                });
                setToken(authToken)
                dispatch(setAuthToken({authToken}));
            } catch (e: any) {
                console.error("could not get an editor access token:", e.error || e.message);
                setToken("")
                dispatch(logoutUser())
            }
        };

        getEditorJwt();
    }, [getAccessTokenSilently, isAuthenticated, authIsLoading, dispatch]);

    const showEditor = !!token

    const nothingView = <main style={{padding: "1rem"}}>
        <p>There's nothing here!</p>
    </main>


    let showToolbar = true;
    if (isMobile && inGame && !isMod) {
        showToolbar = false
    }

    const menu = <Header>
              <span>
              <div className="logo">
                <img src={logo} className="icon" alt="Bort Trivia"/>
              </div>
              <Menu defaultSelectedKeys={['2']} mode="horizontal" theme="dark"
                    defaultOpenKeys={showEditor ? ['sub1'] : []}>
                <Menu.Item key="1">
                    <Link to={"/"}>Play</Link>
                </Menu.Item>

                <SubMenu key="sub1" icon={<FormOutlined/>} title="Editor" disabled={!showEditor}>
                  <Menu.Item key="6" disabled={!showEditor}>
                      <Link to={"categories"}>{CATEGORY}</Link>
                  </Menu.Item>
                  <Menu.Item key="2" disabled={!showEditor}>
                    <Link to={"questions"}>{QUESTION}</Link>
                  </Menu.Item>
                  <Menu.Item key="3" disabled={!showEditor}>
                      <Link to={"rounds"}>{ROUND}</Link>
                  </Menu.Item>
                  <Menu.Item key="4" disabled={!showEditor}>
                      <Link to={"games"}>{GAME}</Link>
                  </Menu.Item>
                  <Menu.Item key="5" disabled={!showEditor}>
                      <Link to={"collections"}>{COLLECTION}</Link>
                  </Menu.Item>
                </SubMenu>

                  <Menu.Item key="7" style={{float: "right"}} className="nohover">
                      <AuthButton loading={authIsLoading}/>
                  </Menu.Item>

              </Menu>
              </span>

    </Header>

    const authRequired = <Outlet/>

    return (
        <Layout className="height-trick" style={{width: '100%', minWidth: 'min(1300px, 100vw)', maxWidth: '100vw'}}>

            <Layout className="site-layout">
                <Content style={{display: 'flex', flexDirection: 'column'}}>
                    <HistoryRouter history={history}>
                        {showToolbar ? menu : null}
                        <Suspense fallback={<RouteFallback/>}>
                            <Routes>
                                <Route path="/" element={<HomePage set_started={setInGame}
                                                                   is_mobile={isMobile}
                                                                   set_is_mod={setIsMod}
                                                                   token={token}/>}/>
                                <Route path="questions"
                                       element={<AuthRequired token={token} component={<QuestionList/>}/>}/>
                                <Route path="rounds" element={authRequired}>
                                    <Route index element={<RoundList token={token}/>}/>
                                </Route>
                                <Route path="games" element={authRequired}>
                                    <Route index element={<GameList token={token}/>}/>
                                </Route>
                                <Route path="collections" element={authRequired}>
                                    <Route index element={<AuthRequired token={token} component={<CollectionList/>}/>}/>
                                </Route>
                                <Route path="categories" element={authRequired}>
                                    <Route index element={<AuthRequired token={token} component={<CategoryList/>}/>}/>
                                </Route>
                                <Route path="*" element={nothingView}/>
                            </Routes>
                        </Suspense>
                    </HistoryRouter>
                </Content>
            </Layout>
        </Layout>
    );
}
