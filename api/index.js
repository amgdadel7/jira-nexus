const createApp = require('./app');

const app = createApp({ serveClient: false });

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => console.log(`Masar running on http://${HOST}:${PORT}`));
}

module.exports = app;
