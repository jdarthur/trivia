import {Breadcrumb} from "antd";
import React from "react";

interface Props {
    breadcrumbs?: React.ReactNode[]
    header?: React.ReactNode
    style?: React.CSSProperties
}

export default function PageHeader(props: Props) {

    const breadcrumbItems = props.breadcrumbs?.map((item, index) => <Breadcrumb.Item key={index}>{item}</Breadcrumb.Item>)

    let style: React.CSSProperties = { marginLeft: 20, marginTop: 15, display: "flex", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap" }
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
