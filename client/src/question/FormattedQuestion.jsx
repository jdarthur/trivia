import React from 'react';

import ReactMarkdown from "react-markdown";

import './Question.css';

class FormattedQuestion extends React.Component {

    render() {
        const renderers = {
            image: ({ alt, src }) => (
                <img alt={alt} src={src} title={alt}
                    style={{ maxWidth: this.props.max_width, maxHeight: '30vh' }} />),
            paragraph: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>),
            blockquote: (({ value, children }) => (<blockquote style={{ paddingRight: 10 }} > {children} </blockquote>)),
            // text: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>)
        };
        return (
            <div>
                <ReactMarkdown source={this.props.question} renderers={renderers} />
                <ReactMarkdown source={this.props.answer} renderers={renderers} className="answer" />
            </div>
        );
    }
}

export default FormattedQuestion