import React from 'react';

import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import {Image} from 'antd'

import './Question.css';

export default function FormattedQuestion(props) {

    let answer = props?.answer
    if (!answer && props.scored) {
        answer = "[no answer]"
    }

    const renderers = {
        img: ({alt, src}) => image(alt, src, props.max_width),
        p: ({value, children}) => (<p style={{"marginBottom": 5}}> {children} </p>),
        a: ({href, children}) => (<a href={href} target={"_blank"}>{children}</a>),
        blockquote: (({value, children}) => (<blockquote style={{paddingRight: 10}}>{children}</blockquote>)),
        code: (({value, children}) => (
            <pre style={{background: "#262626", color: "#fafafa"}}>{asCode(children.toString())}</pre>)),
        // text: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>)
    };
    return (
        <div>
            <ReactMarkdown components={renderers}
                           children={props.question}
                           remarkPlugins={[remarkGfm]}
            />
            <ReactMarkdown components={renderers} className="answer" children={answer}/>
        </div>
    );
}

const lineNumberBaseStyle = {
    background: "#595959",
    color: "#8c8c8c",
    paddingRight: 25,
    paddingLeft: 10,
    marginRight: 10,
    paddingTop: 5
}

function image(alt, src, maxWidth) {
    return <Image style={{maxWidth: maxWidth, maxHeight: '30vh'}} src={src} title={alt} alt={alt}/>
}

function asCode(rawText) {

    return rawText.split("\n").slice(0, -1).map((line, index) => {
        const style1 = {...lineNumberBaseStyle}
        const style2 = {padding: 5, height: '1em'}
        if (index > 0) {
            style1.paddingTop = 0
            style2.paddingTop = 0
        }

        return <div style={{marginBottom: 0, display: "flex"}}>
            <span style={style1}>{index}</span>
            <span style={style2}>{line}</span>
        </div>
    })
}
