import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local shell. Never put the service role key in VITE_ variables or commit it.');
const supabase=createClient(url,key,{auth:{persistSession:false}});
const catalog=JSON.parse(await fs.readFile(new URL('../src/catalog.seed.json',import.meta.url),'utf8'));
const entries=[...catalog.products,...catalog.wines,...catalog.cocktails];let done=0,failed=0,skipped=0;
for(const item of entries){if(!item.image?.startsWith('/images/')){skipped++;continue;}const localPath=new URL(`../public${item.image}`,import.meta.url);try{const bytes=await fs.readFile(localPath);const ext=path.extname(localPath.pathname).slice(1);const contentType=ext==='jpg'?'image/jpeg':`image/${ext}`;const storagePath=`${item.id}/${path.basename(localPath.pathname)}`;const {error:uploadError}=await supabase.storage.from('product-images').upload(storagePath,bytes,{upsert:true,contentType});if(uploadError)throw uploadError;const {data}=supabase.storage.from('product-images').getPublicUrl(storagePath);const {error:updateError}=await supabase.from('products').update({image_url:data.publicUrl}).eq('id',item.id);if(updateError)throw updateError;done++;}catch(e){failed++;console.error(`FAIL ${item.id}:`,e.message);}}
console.log(`Uploaded ${done} product photos; ${failed} failed; ${skipped} still use remote URLs and were skipped.`);
