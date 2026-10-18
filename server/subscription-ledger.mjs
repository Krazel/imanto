// Pure reference model for the FUTURE authenticated transactional wallet service.
// Not imported by the game. Inputs must come from verified Apple server data and
// the approved product catalogue, NEVER from JavaScript, local time or the user.
export const newWallet=()=>({grants:[],cycles:{},claims:{}});
export const walletBalance=wallet=>wallet.grants.reduce((n,g)=>n+(g.revoked?0:g.remaining),0);
export function grantVerifiedCycle(wallet,{transactionId,cycleId,quota}){
  if(typeof transactionId!=='string'||!transactionId||typeof cycleId!=='string'||!cycleId||!Number.isSafeInteger(quota)||quota<1)throw Error('Invalid verified grant');
  if(wallet.grants.some(g=>g.transactionId===transactionId))return wallet;
  const next=structuredClone(wallet),previous=Object.hasOwn(next.cycles,cycleId)?next.cycles[cycleId]:0,amount=Math.max(0,quota-previous);
  // A higher tier grants only the difference in the same normalized billing cycle.
  // Lower/out-of-order transactions never reduce the cycle cap or mint again.
  Object.defineProperty(next.cycles,cycleId,{value:Math.max(previous,quota),enumerable:true,writable:true,configurable:true});
  next.grants.push({transactionId,cycleId,amount,remaining:amount,revoked:false});return next;
}
export function revokeGrant(wallet,transactionId){
  const next=structuredClone(wallet);for(const grant of next.grants)if(grant.transactionId===transactionId){grant.revoked=true;grant.remaining=0;}return next;
}
export function claimRemoval(wallet,gameId,receipt,{unlimited=false}={}){
  if(typeof gameId!=='string'||!gameId||gameId.length>100||typeof receipt!=='string'||!receipt)throw Error('Invalid claim');
  if(Object.hasOwn(wallet.claims,gameId))return {wallet,claim:wallet.claims[gameId]};
  // `unlimited` is the server's verified current entitlement, never client input.
  if(!unlimited&&!walletBalance(wallet))return {wallet,claim:null};
  const next=structuredClone(wallet),grant=unlimited?null:next.grants.find(g=>!g.revoked&&g.remaining>0);if(grant)grant.remaining--;
  const claim={gameId,receipt,transactionId:grant?.transactionId??null,source:unlimited?'unlimited':'credit'};
  Object.defineProperty(next.claims,gameId,{value:claim,enumerable:true,writable:true,configurable:true});
  return {wallet:next,claim};
}
