const express = require("express");
const cors = require("cors");

const port = 3001;

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send({
    message: "Hello World from Express API backend!",
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
