import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderQuality } from '../src/render-quality.js';
import { DomSync } from '../src/ui/dom-sync.js';
import { Window } from 'happy-dom';

test('economy changes rendering limits with bounded DPR and leaves user high mode stable under load', () => {
  const q = new RenderQuality(); q.setMode('economy'); assert.equal(q.settings(2).pixelRatio,1);assert.equal(q.settings(2).maxFps,30);
  assert.ok(q.settings(2).particleFraction < 1);assert.equal(q.settings(.8).pixelRatio,.8);
  q.setMode('high');for(let i=0;i<1000;i++)q.observe(50,.016);assert.equal(q.settings(2).pixelRatio,1.6);
});
test('automatic quality ignores one slow frame, reduces sustained load and requires sustained recovery', () => {
  const q=new RenderQuality();q.observe(100,.016);assert.equal(q.settings(2).pixelRatio,1.6);
  for(let i=0;i<400;i++)q.observe(45,.016);assert.equal(q.settings(2).maxFps,30);
  q.observe(3,.016);assert.equal(q.settings(2).maxFps,30);
  for(let i=0;i<1000;i++)q.observe(3,.016);assert.equal(q.settings(2).maxFps,60);
});
test('DOM synchronization skips unchanged text/markup/attributes and hidden telemetry but refreshes it when shown', async () => {
  const w=new Window();try {
    w.document.body.innerHTML='<section hidden><output>old</output></section><button></button>';
    const sync=new DomSync(),button=w.document.querySelector('button'),output=w.document.querySelector('output');
    sync.html(button,'<svg><path d="M1 1"/></svg>');sync.attr(button,'aria-pressed',false);
    const observer=new w.MutationObserver(()=>{});observer.observe(w.document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    sync.html(button,'<svg><path d="M1 1"/></svg>');sync.attr(button,'aria-pressed',false);assert.deepEqual(observer.takeRecords(),[]);
    sync.visibleOnly=true;sync.text(output,'new');assert.equal(output.textContent,'old');
    output.parentElement.hidden=false;sync.text(output,'new');assert.equal(output.textContent,'new');
    observer.disconnect();
  } finally {await w.happyDOM.close();}
});
