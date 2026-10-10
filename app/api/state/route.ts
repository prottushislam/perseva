import { env } from 'cloudflare:workers';
import { emptyState, stateSchema } from '@/lib/study';
const cookieName='perseva_space';
const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
function db(){if(!env.DB)throw new Error('Study storage unavailable'); return env.DB;}
async function identity(request:Request){
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const valid=token && /^[a-f0-9]{64}$/.test(token);
  const value=valid?token:Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  return {id:hash,isNew:!valid,cookie:`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
export async function GET(request:Request){try{
  const user=await identity(request);
  await db().prepare('INSERT OR IGNORE INTO study_spaces (id,data,revision,updated_at) VALUES (?,?,0,?)').bind(user.id,JSON.stringify(emptyState),Date.now()).run();
  const row=await db().prepare('SELECT data,revision FROM study_spaces WHERE id=?').bind(user.id).first<{data:string,revision:number}>();
  if(!row)throw new Error('Could not load space');
  return new Response(JSON.stringify({state:JSON.parse(row.data),revision:row.revision}),{headers:{...headers,'Set-Cookie':user.cookie}});
}catch(e){console.error('load study space',e);return Response.json({error:'Your study space could not load. Please try again.'},{status:503,headers});}}
export async function PUT(request:Request){try{
  const origin=request.headers.get('origin');
  if(!origin || origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Request not allowed.'},{status:403,headers});
  if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Use JSON.'},{status:415,headers});
  const raw=await request.text();if(raw.length>300000)return Response.json({error:'Study space is too large.'},{status:413,headers});
  let input;try{input=JSON.parse(raw);}catch{return Response.json({error:'Invalid JSON.'},{status:400,headers});}
  if(!input || typeof input!=='object')return Response.json({error:'Invalid study space.'},{status:400,headers});
  const parsed=stateSchema.safeParse(input.state);
  if(!parsed.success || !Number.isSafeInteger(input.revision) || input.revision<0)return Response.json({error:parsed.success?'Invalid revision.':parsed.error.issues[0].message},{status:400,headers});
  const user=await identity(request);if(user.isNew)return Response.json({error:'Reload your study space before saving.'},{status:401,headers});
  const result=await db().prepare('UPDATE study_spaces SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(parsed.data),Date.now(),user.id,input.revision).run();
  if(!result.meta.changes)return Response.json({error:'Your study space changed in another tab. Reload before saving.'},{status:409,headers});
  return Response.json({revision:input.revision+1},{headers});
}catch(e){console.error('save study space',e);return Response.json({error:'Changes could not be saved. Please try again.'},{status:503,headers});}}
