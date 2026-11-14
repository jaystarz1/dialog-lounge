const https = require('https');
// Fixed Docker peer, not caller-controlled URL/headers. Fail closed.
module.exports = function loungeAdmission(cookie) {
  if (!cookie) return Promise.resolve(false);
  return new Promise(resolve => {
    const req = https.get({ hostname: 'hubs-client', port: 8080,
      path: '/_lounge/validate?audience='+encodeURIComponent('https://'+(process.env.PUBLIC_VOICE_HOST||'lounge-voice.thechatbotgenius.com')), rejectUnauthorized: false,
      headers: { Cookie: cookie } }, res => {
      res.resume(); resolve(res.statusCode === 204);
    });
    req.on('error', () => resolve(false));
  });
};
