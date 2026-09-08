import { test, expect } from '@playwright/test';
test('local Worker note photos persist and disappear with removal', async ({ page, request }) => {
  const base='http://127.0.0.1:8787';
  const id=crypto.randomUUID();
  const response=await request.post(base+'/api/items',{data:{id,type:'note',title:'Photo UI QA '+id,content:'local only',startDate:'2026-09-08',dueDate:null}});
  expect(response.status()).toBe(201);
  try {
    await page.goto(base); await page.getByRole('button',{name:'건너뛰기'}).click();
    await expect(page.locator('.startup')).toHaveCount(0);
    await page.locator('[data-target="note"] button').click({force:true});
    await page.getByText('Photo UI QA '+id,{exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    await expect(page.locator('.photo-thumb img')).toBeVisible();
    await expect.poll(async()=>{const r=await request.get(base+'/api/items');return (await r.json()).find((i:any)=>i.id===id).photos.length}).toBe(1);
    await page.getByRole('button',{name:'사진 삭제'}).click();
    await expect(page.locator('.photo-thumb')).toHaveCount(0);
    await expect.poll(async()=>{const r=await request.get(base+'/api/items');return (await r.json()).find((i:any)=>i.id===id).photos.length}).toBe(0);
  } finally { await fetch(base+'/api/items/'+id,{method:'DELETE'}); }
});
