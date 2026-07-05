// Minimal stand-in for the Next standalone server: binds PORT and answers 200.
const http = require("node:http");
const port = Number(process.env.PORT);
http.createServer((_req, res) => { res.writeHead(200); res.end("ok"); })
  .listen(port, "127.0.0.1");
