const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
createApp().listen(PORT, HOST, () => console.log(`Masar running on http://${HOST}:${PORT}`));
