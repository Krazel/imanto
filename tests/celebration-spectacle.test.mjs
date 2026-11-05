import test from 'node:test';
import assert from 'node:assert/strict';
import {createCelebration,celebrationFor} from '../web/celebration.mjs';
import {effectScene} from '../web/effect-demos.mjs';
import {playTurn} from '../web/engine.mjs';

class Element{
  constructor(){
    this.children=[];this.dataset={};this.values=new Map();this.classes=new Set();this.clientWidth=266;
    this.style={setProperty:(key,value)=>this.values.set(key,value),getPropertyValue:key=>this.values.get(key)};
    this.classList={add:(...names)=>names.forEach(x=>this.classes.add(x)),remove:(...names)=>names.forEach(x=>this.classes.delete(x)),contains:name=>this.classes.has(name)};
  }
  set className(value){this.classes=new Set(value.split(' '));}
  setAttribute(){}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
}
const allNodes=node=>node.children.flatMap(child=>[child,...allNodes(child)]);
const byClass=(node,name)=>allNodes(node).filter(x=>x.classes.has(name));

test('real double/triple/streak/all-clear frames keep surfaces, rewards and bounded effects with complete cleanup',()=>{
  const saved=globalThis.document;globalThis.document={createElement:()=>new Element()};
  try{
    const board=new Element(),game=new Element(),fx=createCelebration(board,game);
    for(const kind of ['single','double','triple','streak','all']){
      const scene=effectScene(kind),result=playTurn(scene.state,scene.at,scene.option,()=>.2);
      const frame=result.frames.find(f=>f.kind==='clear'),tiles=frame.cleared.map(at=>{
        const tile=new Element();tile.dataset.id=frame.board[at].id;tile.className='tile coral';
        tile.style.setProperty('background','material-sentinel');return tile;
      });
      const info=fx.start(frame,tiles);
      assert.equal(byClass(board,'celebration-card').length,1);
      for(const tile of tiles)assert.equal(tile.style.getPropertyValue('background'),'material-sentinel');
      if(kind==='single'){
        assert.equal(byClass(board,'celebration-burst').length,0);
        assert.equal(byClass(board,'spring-mote').length,5);
      }else{
        assert.equal(byClass(board,'win-beam').length,frame.lines.length);
        assert.equal(byClass(board,'win-ring').length,kind==='all'?3:2);
        assert.equal(byClass(board,'win-board-wave').length,kind==='all'?1:0);
        assert.ok(byClass(board,'win-ray').length>=10);
        for(const spark of byClass(board,'win-spark')){
          assert.ok(Math.abs(parseFloat(spark.style.getPropertyValue('--dx')))<=board.clientWidth/2);
          assert.ok(Math.abs(parseFloat(spark.style.getPropertyValue('--dy')))<=board.clientWidth/2);
        }
        assert.equal(byClass(board,'celebration-seal')[0].textContent,kind==='all'?'✦':kind==='streak'?'×3':String(frame.lineCount));
        assert.equal(info.charge+info.clearDuration+info.linger,kind==='all'?1410:1010);
      }
      fx.finish();assert.equal(board.children[0].children.length,0);assert.equal(game.classes.size,0);
    }
  }finally{globalThis.document=saved;}
});

test('6×6 origins follow actual cleared cells and a new celebration replaces the old burst',()=>{
  const saved=globalThis.document;globalThis.document={createElement:()=>new Element()};
  try{
    const board=new Element(),fx=createCelebration(board,new Element(),6);
    const frame={lineCount:2,multiplier:1,gain:240,allClear:false,lines:[{axis:'row',index:5},{axis:'column',index:0}],cleared:[30,31,32,33,34,35,0,6,12,18,24]};
    fx.start(frame,[]);fx.start(frame,[]);
    assert.equal(byClass(board,'celebration-burst').length,1);
    assert.equal(byClass(board,'win-glint').length,22);
    assert.equal(byClass(board,'win-glint')[0].style.getPropertyValue('--origin-y'),`${(5+.5)*100/6}%`);
    fx.finish();assert.equal(board.children[0].children.length,0);
  }finally{globalThis.document=saved;}
  assert.equal(celebrationFor({lineCount:1,gain:50}).clearDuration,700);
});
