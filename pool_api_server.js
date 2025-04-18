// pool_api_server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let poolSystems = [];

app.post('/createServer', (req, res) => {
  const { username, apiUrl, controlUrl } = req.body;
  if (!username || !apiUrl) return res.status(400).json({ error: 'Missing required fields' });
  const existing = poolSystems.find(p => p.username === username);
  if (!existing) poolSystems.push({ username, apiUrl, controlUrl });
  res.json({ success: true, message: 'Pool system registered' });
});

app.get('/poolList', async (req, res) => {
  const allPools = [];
  for (const system of poolSystems) {
    try {
      const response = await axios.get(system.apiUrl);
      const data = response.data;
      for (const [systemId, pool] of Object.entries(data)) {
        allPools.push({
          systemId,
          name: pool.name || 'Unnamed Pool',
          status: pool.status,
          dataEndpoint: `${req.protocol}://${req.get('host')}/pool?systemId=${systemId}`,
          controlEndpoint: `${req.protocol}://${req.get('host')}/control`
        });
      }
    } catch (err) {
      console.error(`❌ Error fetching data for ${system.username}:`, err.message);
    }
  }
  res.json(allPools);
});

app.get('/pool', async (req, res) => {
  const { systemId } = req.query;
  if (!systemId) return res.status(400).json({ error: 'Missing systemId' });
  for (const system of poolSystems) {
    try {
      const response = await axios.get(system.apiUrl);
      const data = response.data;
      const pool = data[systemId];
      if (pool) {
        return res.json({ systemId, name: pool.name, status: pool.status, ...pool.devices });
      }
    } catch (err) {
      console.error(err.message);
    }
  }
  res.status(404).json({ error: 'Pool not found' });
});

app.get('/poolByIndex', async (req, res) => {
  const { server, index } = req.query;
  if (!server || index === undefined) return res.status(400).json({ error: 'Missing server or index' });
  const system = poolSystems.find(p => p.username === server);
  if (!system) return res.status(404).json({ error: 'Server not found' });
  try {
    const response = await axios.get(system.apiUrl);
    const data = response.data;
    const entries = Object.entries(data);
    const entry = entries[parseInt(index)];
    if (!entry) return res.status(404).json({ error: 'Index out of range' });
    const [systemId, pool] = entry;
    return res.json({ systemId, name: pool.name, status: pool.status, ...pool.devices });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch pool data' });
  }
});

app.get('/poolCount', async (req, res) => {
  const { server } = req.query;
  if (!server) return res.status(400).json({ error: 'Missing server' });
  const system = poolSystems.find(p => p.username === server);
  if (!system) return res.status(404).json({ error: 'Server not found' });
  try {
    const response = await axios.get(system.apiUrl);
    const data = response.data;
    const count = Object.keys(data).length;
    return res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch pool count' });
  }
});

app.get('/generateIndexList', async (req, res) => {
  const { server } = req.query;
  if (!server) return res.status(400).json({ error: 'Missing server' });
  const system = poolSystems.find(p => p.username === server);
  if (!system) return res.status(404).json({ error: 'Server not found' });
  try {
    const response = await axios.get(system.apiUrl);
    const count = Object.keys(response.data).length;
    const indexList = Array.from({ length: count }, (_, i) => i);
    res.json(indexList);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to generate index list' });
  }
});

app.post('/control', async (req, res) => {
  const { systemId, action, value } = req.body;
  if (!systemId || !action) return res.status(400).json({ error: 'Missing systemId or action' });
  const system = poolSystems.find(p => p.apiUrl.includes(systemId.slice(0, 6)));
  if (!system) return res.status(404).json({ error: 'System not found' });
  try {
    const result = await axios.post(system.controlUrl, { systemId, action, value });
    res.json({ success: true, response: result.data });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to send control command' });
  }
});

app.listen(PORT, () => console.log(`🚀 Pool API Server running on port ${PORT}`));
