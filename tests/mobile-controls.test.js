import {test} from 'node:test';
import assert from 'node:assert/strict';
import {joystickMask} from '../src/mobile-controls.js';
test('joystick has a dead zone and eight predictable directions',()=>{
 assert.equal(joystickMask(0,0,40),0);assert.equal(joystickMask(4,2,40),0);
 for(const [x,y,mask] of [[30,0,128],[30,30,160],[0,30,32],[-30,30,96],[-30,0,64],[-30,-30,80],[0,-30,16],[30,-30,144]])assert.equal(joystickMask(x,y,40),mask);
});
