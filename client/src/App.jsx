import React from 'react';
import './App.css';
import HomePage from "./homepage/Homepage.jsx"
import Editor from "./editor/Editor.jsx"

import logo from "./borttrivia.png"

import 'antd/dist/antd.css';
import { Layout, Menu } from 'antd';
import {
  FormOutlined,
  PlaySquareOutlined
} from '@ant-design/icons';

const { Content, Sider } = Layout;
const { SubMenu } = Menu;

const PLAY = "Play"
const EDITOR = "Editor"
const QUESTION = "Questions"
const ROUND = "Rounds"
const GAME = "Games"

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selected: PLAY,
      editor_section: QUESTION,
      collapsed: false
    }
  }

  componentDidMount() {
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let key = params.get("key");
    this.setState({ key: key })
  }

  set_show_toolbar = (value) => {
    this.setState({ show_toolbar: value })
  }

  play = () => { this.setState({ selected: PLAY }) }

  edit_question = () => { this.setState({ selected: EDITOR, editor_section: QUESTION }) }
  edit_round = () => { this.setState({ selected: EDITOR, editor_section: ROUND }) }
  edit_game = () => { this.setState({ selected: EDITOR, editor_section: GAME }) }


  toggleCollapsed = () => { this.setState({collapsed: !this.state.collapsed}); }

  render() {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={this.state.collapsed} onCollapse={this.toggleCollapsed}>
          <div className={this.state.collapsed? "logo logo-min" : "logo"}>
            <img src={logo} className="icon" alt="Bort Trivia"/>
            {this.state.collapsed ? null : <div> Bort Trivia </div>}
          </div>
          <Menu
            defaultSelectedKeys={['2']}
            defaultOpenKeys={['sub1']}
            mode="inline"
            theme="dark"
            inlineCollapsed={this.state.collapsed} >
            <Menu.Item key="2" icon={<PlaySquareOutlined />} onClick={this.play}>
              Play
          </Menu.Item>
            <SubMenu key="sub1" icon={<FormOutlined />} title="Editor">
              <Menu.Item key="5" onClick={this.edit_question}>{QUESTION}</Menu.Item>
              <Menu.Item key="6" onClick={this.edit_round}>{ROUND}</Menu.Item>
              <Menu.Item key="7" onClick={this.edit_game}>{GAME}</Menu.Item>
            </SubMenu>

          </Menu>
        </Sider>

        <Layout className="site-layout">
          <Content style={{ margin: '0 16px' }}>

            <div className="site-layout-background" style={{ padding: 12, minHeight: 360 }}>
              {this.state.selected === PLAY ? <HomePage /> : null}
              {this.state.selected === EDITOR ? <Editor section={this.state.editor_section} /> : null}
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

}

export default App;
