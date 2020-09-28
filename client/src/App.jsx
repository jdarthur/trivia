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
      collapsed: true,
      show_toolbar: true
    }
  }

  componentDidMount() {
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let key = params.get("key");
    this.setState({ key: key, show_toolbar: key == "12344321"})
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
            {this.state.collapsed ? null : <div> bort trivia </div>}
          </div>
          <Menu
            defaultSelectedKeys={['2']}
            defaultOpenKeys={ (this.state.show_toolbar && !this.state.collapsed) ? ['sub1'] : [] }
            mode="inline"
            theme="dark"
            inlineCollapsed={this.state.collapsed} >
            <Menu.Item key="2" icon={<PlaySquareOutlined />} onClick={this.play}>
              Play
          </Menu.Item>
            <SubMenu key="sub1" icon={<FormOutlined />} title="Editor" disabled={!this.state.show_toolbar} >
              <Menu.Item key="5" onClick={this.edit_question} disabled={!this.state.show_toolbar} >{QUESTION}</Menu.Item>
              <Menu.Item key="6" onClick={this.edit_round} disabled={!this.state.show_toolbar} >{ROUND}</Menu.Item>
              <Menu.Item key="7" onClick={this.edit_game} disabled={!this.state.show_toolbar} >{GAME}</Menu.Item>
            </SubMenu>

          </Menu>
        </Sider>

        <Layout className="site-layout">
          <Content style={{ 'margin': '16px' }}>

            <div className="site-layout-background" style={{ minHeight: 360 }}>
              {this.state.selected === PLAY ? <HomePage set_toolbar={this.set_show_toolbar}/> : null}
              {this.state.selected === EDITOR ? <Editor section={this.state.editor_section} /> : null}
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

}

export default App;
