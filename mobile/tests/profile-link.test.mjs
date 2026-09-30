import test from 'node:test';
import assert from 'node:assert/strict';
import { profileLink } from '../src/reservations/profileLink.ts';
test('person icon links to a verified real profile or a labeled demo public Facebook profile',()=>{
 const guest={profileUrl:'https://www.facebook.com/zuck',profileVerifiedManually:false};
 assert.equal(profileLink(guest,false),null);
 assert.equal(profileLink({...guest,profileVerifiedManually:true},false).url,guest.profileUrl);
 assert.equal(profileLink({...guest,profileUrl:null,profileVerifiedManually:true},false),null);
 assert.equal(profileLink(guest,true).url,guest.profileUrl);
 assert.match(profileLink(guest,true).label,/public sample/);
 assert.equal(profileLink({...guest,profileUrl:null},true).url,'https://www.facebook.com/');
 assert.match(profileLink({...guest,profileUrl:null},true).label,/not a guest profile/);
});
