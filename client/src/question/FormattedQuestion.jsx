import React from 'react';

import ReactMarkdown from "react-markdown";

import './Question.css';

class FormattedQuestion extends React.Component {

    render() {
        const renderers = {
            img: ({ alt, src }) => (
                <img alt={alt} src={src} title={alt}
                    style={{ maxWidth: this.props.max_width, maxHeight: '30vh' }} />),
            p: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>),
            blockquote: (({ value, children }) => (<blockquote style={{ paddingRight: 10 }} > {children} </blockquote>)),
            // text: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>)
        };
        return (
            <div>
                <ReactMarkdown components={renderers}  children={this.props.question}/>
                <ReactMarkdown components={renderers} className="answer"  children={this.props.answer}/>
            </div>
        );
    }
}

export default FormattedQuestion