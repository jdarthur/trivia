const { createProxyMiddleware } = require('http-proxy-middleware');

const EDITOR_HOST = process.env.REACT_APP_EDITOR_HOST
const GAMEPLAY_HOST = process.env.REACT_APP_GAMEPLAY_HOST || EDITOR_HOST
const EDITOR_PORT = process.env.REACT_APP_EDITOR_PORT
const GAMEPLAY_PORT = process.env.REACT_APP_GAMEPLAY_PORT

console.log(EDITOR_HOST)
console.log(GAMEPLAY_HOST)

console.log("editor: " + EDITOR_PORT)
console.log("gameplay: " + GAMEPLAY_PORT)


module.exports = function(app) {
  app.use('/editor', createProxyMiddleware({ target: 'http://' + EDITOR_HOST + ':' + EDITOR_PORT}));
  app.use('/gameplay', createProxyMiddleware({ target: 'http://' + GAMEPLAY_HOST + ':' + GAMEPLAY_PORT}));
  app.use('/images', createProxyMiddleware({ target: 'http://' + EDITOR_HOST + ':' + EDITOR_PORT}));
};
