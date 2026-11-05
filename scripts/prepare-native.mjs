import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
const web=path.join(root,'web'),out=path.join(root,'ios/Web');
fs.mkdirSync(out,{recursive:true});
const spriteAssets={name:'offline-sprite-atlases',setup(build){build.onLoad({filter:/[\\/]sprite-atlases\.mjs$/},args=>{
 let contents=fs.readFileSync(args.path,'utf8');
 contents=contents.replace(/(["'])(assets\/materials\/[\w.-]+\.png)\1/g,(_,quote,name)=>JSON.stringify(`data:image/png;base64,${fs.readFileSync(path.join(web,name)).toString('base64')}`));
 return {contents,loader:'js',resolveDir:path.dirname(args.path)};
});}};
const result=await build({stdin:{contents:"import './appearance.mjs';import './app.mjs';",resolveDir:web},bundle:true,format:'iife',target:'safari16',write:false,legalComments:'inline',plugins:[spriteAssets]});
let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
html=html.replace('<html lang="es">','<html lang="en">').replace(/<script type="module"[^>]*><\/script>/g,'');
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,name)=>'<style>'+fs.readFileSync(path.join(web,name),'utf8')+'</style>');
// Runtime exposes embedded PNGs as cached local Blob URLs. CSS fallbacks must
// neither fetch files nor duplicate the large image data into custom properties.
html=html.replace(/url\(['"]?(assets\/materials\/[\w.-]+\.png)['"]?\)/g,'none');
html=html.replace(/<details class="testing-links">[\s\S]*?<\/details>/,'');
html=html.replace('</head>','<style>.audio-previews,.testing-links{display:none!important}html{-webkit-touch-callout:none}input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}.game{padding-bottom:18px}dialog{max-height:92svh}</style></head>');
html=html.replace('</body>','<script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body>');
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('Prepared self-contained offline Imanto: '+Buffer.byteLength(html)+' bytes; no network requests or module-loader dependency.');
if(fs.existsSync(path.join(out,'six.html')))fs.rmSync(path.join(out,'six.html'));
