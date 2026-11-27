import type { APIRoute } from 'astro';
export const prerender = false;
const categories: Record<string, number> = {news:1,trails:3,pois:4,tips:5,gear:6};
const plain = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#0?39;/gi,"'").replace(/&#8217;/g,'’').replace(/&#8211;/g,'–').replace(/\s+/g,' ').trim();
export const GET: APIRoute = async ({url}) => {
 const key=url.searchParams.get('category') ?? '';
 const id=Object.hasOwn(categories,key)?categories[key]:null;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30, s-maxage=30'};
 if(!id)return new Response(JSON.stringify({error:'invalid_category'}),{status:400,headers});
 try{
  const endpoint=new URL('https://cms.panachaikotrails.gr/');
  endpoint.searchParams.set('rest_route','/wp/v2/posts');
  endpoint.searchParams.set('categories',String(id));
  endpoint.searchParams.set('status','publish');
  endpoint.searchParams.set('per_page','20');
  endpoint.searchParams.set('orderby','date');
  endpoint.searchParams.set('order','desc');
  endpoint.searchParams.set('_embed','wp:featuredmedia');
  const r=await fetch(endpoint,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('CMS unavailable');
  const posts=await r.json();if(!Array.isArray(posts))throw Error('Invalid CMS response');
  const items=posts.filter(p=>Number.isSafeInteger(p?.id)).map(p=>{
   const media=p?._embedded?.['wp:featuredmedia']?.[0];
   return {id:p.id,title:plain(p.title?.rendered),excerpt:plain(p.excerpt?.rendered),image:media?.media_details?.sizes?.medium_large?.source_url||media?.source_url||null,alt:plain(media?.alt_text)};
  });
  return new Response(JSON.stringify({items}),{headers});
 }catch{return new Response(JSON.stringify({error:'cms_unavailable'}),{status:502,headers:{...headers,'Cache-Control':'no-store'}})}
};
