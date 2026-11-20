import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scrollbar,scrollFromThumb} from '../.test-build/scrollbar.js';

test('scroll thumb reaches both document ends, including zoomed documents',()=>{
  for(const [content,visible,track] of [[704,400,368],[640,528,496],[640,132,496]]){
    const start=scrollbar(content,visible,track,0);
    const end=scrollbar(content,visible,track,content);
    assert.equal(start.position,0);assert.equal(end.position,end.travel);
    assert.equal(scrollFromThumb(-50,start),0);
    assert.equal(scrollFromThumb(start.travel+50,start),content-visible);
    assert.ok(Math.abs(scrollFromThumb(start.travel/2,start)-(content-visible)/2)<=0.5);
  }
});

test('a document fitting the viewport cannot scroll',()=>{
  const metrics=scrollbar(80,528,496,100);
  assert.equal(metrics.size,496);assert.equal(metrics.position,0);
  assert.equal(scrollFromThumb(100,metrics),0);
});
