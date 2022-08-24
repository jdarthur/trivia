import {Breadcrumb} from "antd";
import React from "react";

export default function PageHeader(props) {

    const breadcrumbItems = props.breadcrumbs?.map((item) => <Breadcrumb.Item>{item}</Breadcrumb.Item>)

    let style = { marginLeft: 20, marginTop: 15, display: "flex", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap" }
    if (props.style) {
        style = Object.assign(style, props.style)
    }

    return <div style={style}>
        <Breadcrumb style={{marginRight: 30}}>
            <Breadcrumb.Item>BortTrivia</Breadcrumb.Item>
            {breadcrumbItems}
        </Breadcrumb>
        <div>
            {props.header}
        </div>
    </div>
}

