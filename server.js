const express = require('express');
const path = require('node:path');

const app = express();
const port = process.env.PORT || 3000;
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => console.log(`Mais Bella disponível em http://localhost:${port}`));
