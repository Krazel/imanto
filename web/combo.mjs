export function readCombo(value,round){
  if(!Number.isSafeInteger(value?.count)||value.count<1||!Number.isSafeInteger(value?.lastRound)||value.lastRound<1||value.lastRound>round||round>value.lastRound+1)return {count:0,lastRound:null};
  return {count:value.count,lastRound:value.lastRound};
}
export function scoreCombo(value,round,scored){
  const current=readCombo(value,round);
  return scored?{count:current.count+1,lastRound:round}:current;
}
