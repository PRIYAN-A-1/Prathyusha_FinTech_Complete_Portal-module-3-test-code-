// Requires an isolated, migrated test PostgreSQL DB, Spring auth and Node API.
// Set TEST_STUDENT_EMAIL/PASSWORD, TEST_OTHER_EMAIL/PASSWORD and TEST_MENTOR_EMAIL/PASSWORD.
// Provision each using the documented operator command. The mentor must have ADMIN role for this test.
import assert from 'node:assert/strict';
const api=process.env.TEST_API||'http://127.0.0.1:3001',auth=process.env.TEST_AUTH||'http://127.0.0.1:8080';
async function request(base,path,{method='GET',token,body,status=200}={}){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{'Content-Type':'application/json'}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
async function login(prefix){const email=process.env[`TEST_${prefix}_EMAIL`],password=process.env[`TEST_${prefix}_PASSWORD`];assert.ok(email&&password,`Set TEST_${prefix}_EMAIL/PASSWORD`);return request(auth,'/auth/login',{method:'POST',body:{email,password}});}
const student=await login('STUDENT'),other=await login('OTHER'),admin=await login('MENTOR'),s=student.access_token,a=admin.access_token;
await request(api,'/api/me/dashboard',{status:401});
await request(api,'/api/me/profile',{method:'PATCH',token:s,body:{role:'ADMIN'},status:400});
await request(api,'/api/me/profile',{method:'PATCH',token:s,body:{display_name:'Integration Student',public_visible:false,skills:['Node.js','PostgreSQL']}});
const today=new Date().toISOString().slice(0,10);
const p=await request(api,'/api/projects',{method:'POST',token:s,status:201,body:{title:`Integration ${Date.now()}`,domain:'FinTech',abstract:'Test project',problem_statement:'Traceable activity',objectives:'Verify security',expected_outcome:'Verified evidence trail',start_date:today,target_date:today}});
await request(api,`/api/projects/${p.id}`,{token:other.access_token,status:403});
await request(api,`/api/projects/${p.id}/review`,{method:'POST',token:s,body:{status:'ACTIVE',review_notes:'Self approve'},status:403});
await request(api,`/api/projects/${p.id}/review`,{method:'POST',token:a,body:{status:'ACTIVE',review_notes:'Approved for integration'}});
const before=await request(api,'/api/me/activity-summary',{token:s});
const c=await request(api,'/api/me/contributions',{method:'POST',token:s,status:201,body:{project_id:p.id,contribution_date:today,work_area:'Testing',description:'Executed integration checks',outcome:'Ownership enforced',evidence_url:'https://github.com/example/test/pull/1'}});
await request(api,`/api/contributions/${c.id}/review`,{method:'POST',token:s,body:{status:'VERIFIED',review_notes:'Self verify'},status:403});
await request(api,`/api/contributions/${c.id}/review`,{method:'POST',token:a,body:{status:'REVISION_REQUIRED',review_notes:'Expand evidence'}});
await request(api,`/api/contributions/${c.id}`,{method:'PATCH',token:s,body:{description:'Expanded test proof',outcome:'All checks passed',evidence_url:'https://github.com/example/test/pull/2'}});
await request(api,`/api/contributions/${c.id}/review`,{method:'POST',token:a,body:{status:'VERIFIED',review_notes:'Evidence reviewed'}});
await request(api,`/api/contributions/${c.id}`,{method:'PATCH',token:s,body:{description:'Tampered',outcome:'Tampered'},status:409});
const after=await request(api,'/api/me/activity-summary',{token:s});assert.equal(after.reported_contributions,before.reported_contributions+1);assert.equal(after.verified_contributions,before.verified_contributions+1);
await request(auth,'/auth/logout',{method:'POST',token:s});await request(api,'/api/me',{token:s,status:401});
console.log('PASS: login, protected profile, cross-student access, project approval, review/revision, real count deltas and logout revocation. Test records are retained in your isolated test database.');
