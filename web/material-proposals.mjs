// Review-only catalog. Production materials remain in block-appearance.mjs.
export const SPECIAL_PROPOSALS=[
 ['special-glass',['Vidrio dicroico','Dichroic glass'],['Facetas de cristal y bordes que refractan la luz.','Crystal facets with light-refracting edges.']],
 ['special-liquid',['Líquido en cápsula','Liquid capsule'],['Una onda de color dentro de una cápsula transparente.','A colored wave inside a transparent capsule.']],
 ['special-sand',['Arena cinética','Kinetic sand'],['Dunas talladas y una superficie de arena mate.','Carved dunes with a matte sand surface.']],
 ['special-circuit',['Circuito de luz','Light circuit'],['Canales luminosos encajados entre raíles de cobre.','Glowing channels set between copper rails.']]
];
export const MATERIAL_FAMILIES=[
 {id:'paper',names:['Papel','Paper'],variants:[
  ['paper',['Plegado original','Original fold'],['Un pliegue diagonal y una esquina doblada.','A diagonal fold and a turned corner.']],
  ['paper-origami',['Origami','Origami'],['Cuatro caras triangulares que se unen en el centro.','Four triangular faces meeting at the center.']],
  ['paper-layered',['Capas de cartulina','Layered card'],['Bordes de hojas apiladas y una cara de papel mate.','Stacked paper edges and a matte paper face.']]
 ]},
 {id:'fabric',names:['Tejido','Fabric'],variants:[
  ['fabric',['Cosido original','Original stitching'],['Trama fina y una costura por el borde.','Fine woven threads with a stitched edge.']],
  ['fabric-quilt',['Acolchado','Quilted'],['Cuatro almohadillas suaves unidas por costuras.','Four soft cushions joined by seams.']],
  ['fabric-knit',['Punto grueso','Chunky knit'],['Lazos grandes entrelazados, como un jersey.','Large interlocking loops, like a knitted sweater.']]
 ]},
 {id:'metal',names:['Aluminio','Aluminum'],variants:[
  ['metal',['Cepillado original','Original brushed'],['Reflejo diagonal y cepillado fino.','A diagonal reflection and fine brushed lines.']],
  ['metal-hammered',['Martillado','Hammered'],['Pequeñas hendiduras redondas, sin marco interior.','Small round hammered dimples, without an inner frame.']],
  ['metal-tread',['Chapa en relieve','Raised tread'],['Rombos metálicos elevados y un borde grueso.','Raised metallic diamonds and a thick rim.']]
 ]},
 {id:'pixel',names:['Píxel','Pixel'],variants:[
  ['pixel',['Arcade original','Original arcade'],['Marco escalonado y centro cuadrado.','A stepped rim and square center.']],
  ['pixel-mosaic',['Mosaico','Mosaic'],['Una retícula de pequeños píxeles con distintas luces.','A grid of small pixels with different highlights.']],
  ['pixel-voxel',['Vóxel','Voxel'],['Una cara elevada con escalones grandes y sombra profunda.','A raised face with large steps and a deep shadow.']]
 ]}
];
export const EXTRA_PROPOSALS=[['neon',['Neón','Neon'],['Marco de luz y un núcleo oscuro.','A glowing frame and a dark center.']]];
export const proposalCatalog=language=>{
 const i=language==='en'?1:0;
 return [...SPECIAL_PROPOSALS,...MATERIAL_FAMILIES.flatMap(f=>f.variants),...EXTRA_PROPOSALS].map(([id,name,description])=>[id,name[i],description[i]]);
};
