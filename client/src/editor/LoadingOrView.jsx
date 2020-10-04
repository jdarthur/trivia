import React from 'react';

import { Empty, Spin } from 'antd';

import {
  LoadingOutlined
} from '@ant-design/icons';


class LoadingOrView extends React.Component {
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