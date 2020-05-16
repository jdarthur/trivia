const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use('/editor', createProxyMiddleware({ target: 'http://localhost:6000'}));
  app.use('/gameplay', createProxyMiddleware({ target: 'http://localhost:5000'}));
};