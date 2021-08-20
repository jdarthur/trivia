import {Menu} from "antd";
import {FormOutlined, PlaySquareOutlined} from "@ant-design/icons";
import AuthButton from "./AuthButton";
import React from "react";

export const PLAY = "Play"
export const EDITOR = "Editor"
export const QUESTION = "Questions"
const ROUND = "Rounds"
const GAME = "Games"

const {SubMenu} = Menu


export const AppMenu = (props) => {

    const edit_question = () => {
        props.edit(QUESTION)
    }
    const edit_round = () => {
        props.edit(ROUND)
    }
    const edit_game = () => {
        props.edit(GAME)
    }

    return (
        <Menu defaultSelectedKeys={['2']} mode="inline" theme="dark"
              inlineCollapsed={props.collapsed}
              defaultOpenKeys={(props.authorized && !props.collapsed) ? ['sub1'] : []}>

            <Menu.Item key="2" icon={<PlaySquareOutlined/>} onClick={props.play}> {PLAY} </Menu.Item>

            <SubMenu key="sub1" icon={<FormOutlined/>} title="Editor"
                     disabled={!props.authorized}>
                <Menu.Item key="5" onClick={edit_question}
                           disabled={!props.authorized}>{QUESTION}</Menu.Item>
                <Menu.Item key="6" onClick={edit_round}
                           disabled={!props.authorized}>{ROUND}</Menu.Item>
                <Menu.Item key="7" onClick={edit_game}
                           disabled={!props.authorized}>{GAME}</Menu.Item>
            </SubMenu>

            <AuthButton setToken={props.setToken}/>

        </Menu>
    );
};


