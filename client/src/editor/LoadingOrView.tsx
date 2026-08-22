import React from 'react';

import { Empty, Spin } from 'antd';

import {
  LoadingOutlined
} from '@ant-design/icons';


interface Props {
    loading: boolean
    empty: boolean
    class_name?: string
    loaded_view?: React.ReactNode
}

class LoadingOrView extends React.Component<Props> {
    render() {
        const view = this.props.empty ?
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No records found" style={{ margin: 50 }} /> :
            this.props.loaded_view

        return (
            <div className={this.props.class_name}>
                { this.props.loading ?
                    <Spin indicator={<LoadingOutlined style={{ fontSize: '4em', margin: 50 }} spin />} />
                    : view
                }
            </div>
        );
    }
}

export default LoadingOrView;
