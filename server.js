const express = require('express');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 10000;

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('Welcome to File Upload Middleware API! Use POST /upload to upload files.');
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.send('File uploaded successfully!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
