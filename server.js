const express = require('express');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// SAP Login
async function loginToSAP() {
  const res = await axios.post(
    'https://sap.uneecopscloud.com:50000/b1s/v1/Login',
    {
      UserName: 'salesforce',
      Password: 'utl1662',
      CompanyDB: 'sftest',
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const cookies = res.headers['set-cookie'];
  const b1 = cookies.find(c => c.includes('B1SESSION')).split(';')[0];
  const route = cookies.find(c => c.includes('ROUTEID')).split(';')[0];

  return `${b1}; ${route}`;
}

// Health Check
app.get('/', (req, res) => {
  res.send('✅ Middleware working.');
});

// File Upload
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, Buffer.from(fileContent, 'base64'));

    const form = new FormData();
    form.append('', fs.createReadStream(tempPath)); // ⬅️ no name field

    const cookie = await loginToSAP();

    const response = await axios.post(
      'https://sap.uneecopscloud.com:50000/b1s/v1/Attachments2',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: cookie
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    fs.unlinkSync(tempPath);
    res.status(200).json(response.data);
  } catch (err) {
    console.error('❌ Upload Failed');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
      res.status(500).json({ error: 'Upload failed', details: err.response.data });
    } else {
      res.status(500).json({ error: 'Upload failed', details: err.message });
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
