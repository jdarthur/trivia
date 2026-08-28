import React from 'react';
import './Editor.css';

import { Input, Checkbox } from 'antd';
import type { CheckboxChangeEvent } from 'antd';

interface Props {
    set_unused_only: (value: boolean) => void
    set_text_filter: (value: string) => void
    unused_only: boolean
    text_filter: string
    data_type: string
    add_button?: React.ReactNode
    // Hide the "Unused only" checkbox for record types nothing references
    // (games sit at the top of the reference tree, so the filter is meaningless
    // there). Defaults to showing it.
    show_unused_only?: boolean
}

class EditorFilter extends React.Component<Props> {

    set_unused_only = (event: CheckboxChangeEvent) => {
        const value = event.target.checked
        this.props.set_unused_only(value)
    }

    set_text_filter = (value: string) => {
        console.log("click search")
        this.props.set_text_filter(value)
    }


    render() {
        const showUnused = this.props.show_unused_only !== false

        return (
            <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingLeft: 5}}>
                <div className="filter_holder">
                    {/* <Input.Group compact> */}
                    <Input.Search placeholder="Search" style={{ width: 150 }} onSearch={this.set_text_filter} />
                    {showUnused &&
                        <div style={{marginLeft: 10}}>
                            <Checkbox onChange={this.set_unused_only} checked={this.props.unused_only} > Unused only </Checkbox>
                        </div>
                    }
                    {/* </Input.Group> */}
                </div>
                {this.props.add_button}
            </div>

        );
    }
}

export default EditorFilter;
