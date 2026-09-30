import test from 'node:test';
import assert from 'node:assert/strict';
import { profileLink } from '../src/reservations/profileLink.ts';
test('person icon links only to a verified real profile or the labeled demo homepage',()=>{
 const guest={profileUrl:'https://www.facebook.com/known-profile',profileVerifiedManually:false};
 assert.equal(profileLink(guest,false),null);
 assert.equal(profileLink({...guest,profileVerifiedManually:true},false).url,guest.profileUrl);
 assert.equal(profileLink({...guest,profileUrl:null,profileVerifiedManually:true},false),null);
 assert.equal(profileLink(guest,true).url,'https://www.facebook.com/');
 assert.match(profileLink(guest,true).label,/not a guest profile/);
});
