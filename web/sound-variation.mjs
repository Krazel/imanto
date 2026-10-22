export const PLACEMENT_VARIANTS=Object.freeze(Array.from({length:5},(_,i)=>`place-spring-${i}`));
// Small recorded pitch differences; each draw excludes the previous pitch.
export function createPlacementVariation(random=Math.random){
  let previous=-1;
  return ()=>{
    const choices=[0,1,2,3,4].filter(i=>i!==previous);
    const value=random();
    const index=Number.isFinite(value)?Math.min(choices.length-1,Math.max(0,Math.floor(value*choices.length))):Math.floor(choices.length/2);
    return previous=choices[index];
  };
}
