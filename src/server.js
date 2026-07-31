'use strict';

const app = require('./app');
const { env } = require('./config/env');

const server = app.listen(env.PORT, () => {
  console.log(`Badge API listening on http://localhost:${env.PORT}`);
});

module.exports = server;
