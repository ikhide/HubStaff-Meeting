const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const express = require("express");
const http = require("http");
const moment = require("moment");
const mongoose = require("mongoose");

const { PORT, NODE_ENV } = process.env;

// server setup
const app = express();
const server = http.Server(app);

app.locals.moment = moment;
app.locals.version = process.env.version;
app.locals.NODE_ENV = NODE_ENV;

app.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));
app.use((req, res, next) => express.json({ limit: "50mb" })(req, res, next));
app.use(bodyParser.text({ limit: "50mb" }));
app.use(cookieParser());

mongoose
  .connect(db, { useNewUrlParser: true })
  .then(() => console.log("mongodb connected"))
  .catch((err) => console.log(err));

// listen to connections
server.listen(PORT);
