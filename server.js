const express = require('express');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// SAP Login Function
async function loginToSAP() {
  console.log('🔐 Logging in to SAP...');
  const loginResponse = await axios.post(
    'https://sap.uneecopscloud.com:50000/b1s/v1/Login',
    {
      UserName: 'salesforce',
      Password: 'utl1662',
      CompanyDB: 'sftest'
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const cookies = loginResponse.headers['set-cookie'];
  const b1session = cookies.find(c => c.includes('B1SESSION'));
  const routeId = cookies.find(c => c.includes('ROUTEID'));

  console.log('✅ SAP session established');
  return `${b1session}; ${routeId}`;
}

// Health Check Route
app.get('/', (req, res) => {
  res.send('✅ Middleware is running and ready to accept uploads chirag.');
});

// File Upload Route
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    console.log(`📥 Received file: ${fileName}`);
    const buffer = Buffer.from(fileContent, 'base64');
    console.log(`📦 File size (bytes): ${buffer.length}`);

    const form = new FormData();
    form.append('', buffer, {
      filename: fileName
    });

    const sapCookie = await loginToSAP();
    console.log('🚀 Uploading to SAP /Attachments2...');

    const sapResponse = await axios.post(
      'https://sap.uneecopscloud.com:50000/b1s/v1/Attachments2',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: sapCookie
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('✅ SAP upload success:', sapResponse.data);
    res.status(200).json(sapResponse.data);
  } catch (err) {
    console.error('❌ Upload Error');
    if (err.response) {
      console.error('📛 SAP Status:', err.response.status);
      console.error('📄 SAP Error Response:', err.response.data);
    } else {
      console.error('📄 Error Message:', err.message);
    }

    res.status(500).json({
      error: 'Upload failed',
      details: err.response?.data || err.message
    });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Middleware listening on port ${port}`);
});
