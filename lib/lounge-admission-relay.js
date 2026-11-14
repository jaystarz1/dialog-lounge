// Admission-only relay: no room data, body logging, redirects, or secret config.
const https=require('https');
module.exports=function admissionRelay(req,res,next){
  if(new URL(req.url,'https://voice.invalid').pathname!=='/_lounge/handoff')return next();
  if(req.method!=='POST'){res.writeHead(405,{'Cache-Control':'no-store'});res.end();return;}
  let body='';
  req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>2048)req.destroy();});
  req.on('end',()=>{
    const upstream=https.request({hostname:'hubs-client',port:8080,path:'/_lounge/handoff',method:'POST',rejectUnauthorized:false,
      headers:{'x-lounge-host':process.env.PUBLIC_VOICE_HOST||'lounge-voice.thechatbotgenius.com','origin':req.headers.origin||'','content-type':'application/x-www-form-urlencoded'}},response=>{
      const headers={'Cache-Control':'no-store','Referrer-Policy':'strict-origin'};
      for(const key of ['set-cookie','content-type','location'])if(response.headers[key])headers[key]=response.headers[key];
      res.writeHead(response.statusCode,headers);response.pipe(res);
    });
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end();});
    upstream.end(body);
  });
};
