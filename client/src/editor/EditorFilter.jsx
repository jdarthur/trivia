import React from 'react';
import './Editor.css';

import { Input, Checkbox } from 'antd';

class EditorFilter extends React.Component {

    set_unused_only = (event) => {
        const value = event.target.checked
        this.props.set_unused_only(value)
    }

    set_text_filter = (value, event) => {
        console.log("click search")
        this.props.set_text_filter(value)
    }


    render() {
        return (
            <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingLeft: 5}}>
                <div className="filter_holder">
                    {/* <Input.Group compact> */}
                    <Input.Search placeholder="Search" style={{ width: 150 }} className="filter-subitem" onSearch={this.set_text_filter} />
                    <div className="filter-subitem">
                        <Checkbox onChange={this.set_unused_only} checked={this.props.unused_only} > Unused {this.props.data_type} only </Checkbox>
                    </div>
                    {/* </Input.Group> */}
                </div>
                {this.props.add_button}
            </div>

        );
    }
}

export default EditorFilter;