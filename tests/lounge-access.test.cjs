const test=require('node:test');
const assert=require('node:assert/strict');
const Room=require('../lib/Room');
test('invalid voice join cannot set joined state or read peers',async()=>{
  const room=Object.create(Room.prototype);
  room._mediasoupRouters=new Map([['fixture',{rtpCapabilities:{}}]]);
  room._authKey='invalid fixture public key';
  let listed=false,accepted=false;
  room._getJoinedPeers=()=>{listed=true;return[];};
  room._consumeExistingProducers=async()=>{};
  const peer={id:'fixture',data:{routerId:'fixture',joined:false}};
  await assert.rejects(room._handleProtooRequest(peer,{method:'join',data:{token:'invalid-fixture'}},()=>{accepted=true;},()=>{}));
  assert.equal(peer.data.joined,false);
  assert.equal(listed,false);
  assert.equal(accepted,false);
});
test('valid room-bound permission joins; other-room tokens cannot read peers',async()=>{
  const crypto=require('crypto');
  const jwt=require('jsonwebtoken');
  const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  for(const scenario of ['wrong-room','cannot-enter','cannot-join','expired','valid','legacy-valid']) {
    const allowed=['valid','legacy-valid'].includes(scenario);
    const room=Object.create(Room.prototype);
    room._roomId='fixture-room';room._authKey=keys.publicKey;
    room._mediasoupRouters=new Map([['fixture',{}]]);
    let listed=false,accepted=false;
    room._getJoinedPeers=()=>{listed=true;return[];};
    room._consumeExistingProducers=async()=>{};
    const peer={id:'fixture',data:{routerId:'fixture',joined:false}};
    const claims={join_hub:scenario!=='cannot-join',hub_id:scenario==='wrong-room'?'other-room':'fixture-room'};
    if(scenario!=='legacy-valid')claims.can_enter=scenario!=='cannot-enter';
    const token=jwt.sign(claims,keys.privateKey,{algorithm:'RS512',expiresIn:scenario==='expired'?-1:60});
    const run=()=>room._handleProtooRequest(peer,{method:'join',data:{token}},()=>{accepted=true;},()=>{});
    if(allowed)await run();else await assert.rejects(run());
    assert.equal(peer.data.joined,allowed);assert.equal(listed,allowed);assert.equal(accepted,allowed);
  }
});
