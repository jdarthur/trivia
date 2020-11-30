import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

let vh = window.innerHeight * 0.01;
// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

window.addEventListener('resize', () => {
  // We execute the same script as before
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
});

const sendData = async function sendData(url, method, data) {
  let body
  if (data !== undefined) {
    const copy = Object.assign({}, data)
    delete copy.id
    delete copy.create_date
    body = JSON.stringify(copy)
  }

  const response = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: body
  })
  return response.json()
}

export default sendData