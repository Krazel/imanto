// Display only: the saved score is always the exact integer.
export function scoreText(value,language='en',{compact=false}={}){
  const number=Number.isSafeInteger(value)&&value>=0?value:0;
  const locale=language==='es'?'es-ES':'en-US';
  const exact=new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(number);
  const text=compact&&number>=1_000_000
    ?new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(number)
    :compact?String(number):exact;
  return {text,exact};
}
export function writeScore(element,value,language,compact=false){
  const {text,exact}=scoreText(value,language,{compact});
  element.textContent=text;element.title=exact;element.dataset.value=String(value);
  element.dataset.wide=String(value).length>6;
  element.dataset.long=exact.length>14;
  fitScore(element);
}
export function fitScore(element){
  // Re-measure at the CSS size, including after rotation or a language change.
  element.style.fontSize='';
  if(!element.clientWidth)return;
  const size=parseFloat(getComputedStyle(element).fontSize);
  if(element.scrollWidth>element.clientWidth){
    element.style.fontSize=`${Math.max(14,Math.floor(size*element.clientWidth/element.scrollWidth))}px`;
  }
}
