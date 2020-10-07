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
            // text: ({ value, children }) => (<p style={{ "marginBottom": 5 }} > {children} </p>)
        };
        return (
            <div>
                <ReactMarkdown source={this.props.question} renderers={renderers} />
                <ReactMarkdown source={this.props.answer} className="answer" />
            </div>
        );
    }
}

export default FormattedQuestion