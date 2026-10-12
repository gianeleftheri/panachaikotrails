import type { APIRoute } from 'astro';
import { createHmac, randomUUID } from 'node:crypto';
export const prerender=false;
const json=(body:object,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const GET:APIRoute=async()=>json({configured:Boolean(import.meta.env.SOS_SHARED_SECRET)});
export const POST:APIRoute=async({request,url})=>{
  if(request.headers.get('origin')!==url.origin)return json({message:'Μη έγκυρη προέλευση αιτήματος.'},403);
  if(Number(request.headers.get('content-length')||0)>4096)return json({message:'Μη έγκυρο αίτημα.'},413);
  const secret=import.meta.env.SOS_SHARED_SECRET;
  if(!secret)return json({message:'Η αυτόματη αποστολή email SOS δεν έχει ακόμη ενεργοποιηθεί.'},503);
  let p:any;try{const raw=await request.text();if(raw.length>4096)return json({message:'Μη έγκυρο αίτημα.'},413);p=JSON.parse(raw);}catch{return json({message:'Μη έγκυρα δεδομένα.'},400);}
  if(!p||typeof p!=='object'||typeof p.email!=='string'||p.email.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||typeof p.latitude!=='number'||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||typeof p.longitude!=='number'||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||typeof p.accuracy!=='number'||!Number.isFinite(p.accuracy)||p.accuracy<0||typeof p.timestamp!=='number'||!Number.isFinite(p.timestamp)||p.timestamp<=0||p.timestamp>Date.now()+60000)return json({message:'Ελέγξτε την επαφή και τη θέση GPS.'},400);
  const body=JSON.stringify({email:p.email.trim(),name:typeof p.name==='string'?p.name.slice(0,100):'',latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy,timestamp:p.timestamp,trail:typeof p.trail==='string'?p.trail.slice(0,160):'',requestId:randomUUID(),sentAt:Date.now(),ip:request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown'});
  try{const response=await fetch('https://cms.panachaikotrails.gr/wp-json/panachaiko/v1/sos',{method:'POST',headers:{'Content-Type':'application/json','X-PT-SOS-Signature':createHmac('sha256',secret).update(body).digest('hex')},body,signal:AbortSignal.timeout(10000),redirect:'error'});const result=await response.json().catch(()=>({}));if(!response.ok||result.ok!==true)return json({message:response.status===429?'Πολλές προσπάθειες email. Χρησιμοποιήστε SMS ή κλήση.':'Η υπηρεσία email SOS δεν ολοκλήρωσε την αποστολή.'},response.status===429?429:502);return json({ok:true});}catch{return json({message:'Δεν επιβεβαιώθηκε αποστολή email. Ελέγξτε τη σύνδεσή σας.'},502);}
};
