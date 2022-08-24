import React, {useEffect, useState} from 'react';
import {Link, Outlet, Route, Routes} from "react-router-dom";

import HomePage from "../homepage/Homepage.jsx"
import AuthButton from "./AuthButton.js"

import './App.css';
import logo from "./borttrivia.png"

import 'antd/dist/antd.css';
import {Layout, Menu} from 'antd';
import {FormOutlined} from '@ant-design/icons';
import QuestionList from "../question/QuestionList";
import RoundList from "../round/RoundList";
import GameList from "../game/GameList";
import CollectionList from "../collections/CollectionList";

const {Content, Header} = Layout;
const {SubMenu} = Menu;

const QUESTION = "Questions"
const ROUND = "Rounds"
const GAME = "Games"
const COLLECTION = "Collections"

export default function App() {

    const [token, setToken] = useState("")
    const [inGame, setInGame] = useState(false)
    const [isMod, setIsMod] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const showEditor = !!token

    useEffect(() => {
        const is_mobile = window.matchMedia("only screen and (max-width: 760px)").matches;
        setIsMobile(is_mobile)
    }, [])

    // componentDidMount()
    // {
    //     const is_mobile = window.matchMedia("only screen and (max-width: 760px)").matches;
    //     this.setState({is_mobile: is_mobile})
    // }

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

                <Menu.Item key="6" style={{float: "right"}} className="nohover"> <AuthButton
                    set_token={setToken}/> </Menu.Item>

              </Menu>
              </span>

    </Header>


    return (
        <Layout className="height-trick" style={{minWidth: 'min(1300px, 100vw)', maxWidth: '100vw'}}>
            {showToolbar?  menu : null}
            <Layout className="site-layout">
                <Content style={{display: 'flex', flexDirection: 'column'}}>
                    <Routes>
                        <Route path="/" element={<Outlet/>}>
                            <Route path="questions" element={<Outlet/>}>
                                <Route index element={<QuestionList token={token}/>}/>
                            </Route>
                            <Route path="rounds" element={<Outlet/>}>
                                <Route index element={<RoundList token={token}/>}/>
                            </Route>
                            <Route path="games" element={<Outlet/>}>
                                <Route index element={<GameList token={token}/>}/>
                            </Route>
                            <Route path="collections" element={<Outlet/>}>
                                <Route index element={<CollectionList />}/>
                            </Route>
                            <Route index element={<HomePage set_started={setInGame}
                                                            is_mobile={isMobile}
                                                            set_is_mod={setIsMod}
                                                            token={token}/>} />
                            <Route path="*" element={nothingView}/>
                        </Route>
                    </Routes>
                </Content>
            </Layout>
        </Layout>
    );
}