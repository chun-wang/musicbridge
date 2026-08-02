import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const INJECTED_IMPL = `    async function handleDownloadCurrent(){
      const tr=state.currentTrack;
      if(!tr||!tr.audioUrl){showToast(t('toastDownloadNotReady'));return;}
      try{
        if(!tr.detailsLoaded){await ensureTrackDetails(tr);}
      }catch(e){
        console.error('ensureTrackDetails for download failed',e);
      }
      const body={title:tr.title||'',author:tr.artist||'',url:tr.audioUrl};
      if(tr.album)body.album=tr.album;
      if(tr.lrc)body.lyrics=tr.lrc;
      if(tr.cover)body.cover=tr.cover;
      fetch('/api/songs',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      })
      .then(res=>{
        if(!res.ok) throw new Error('HTTP '+res.status);
        return res.json();
      })
      .then(j=>{
        const dl=j.data&&j.data.download;
        const msg=state.language==='zh'
          ? (dl?('已下载：'+dl.fileName):'已提交到服务端')
          : (dl?('Downloaded: '+dl.fileName):'Submitted to server');
        showToast(msg);
      })
      .catch(e=>{
        console.error('download to server failed',e);
        showToast(state.language==='zh'?'下载失败':'Download failed');
      });
    }`;

const FUNC_START = 'function handleDownloadCurrent(){';

function findFunctionEnd(html: string, startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < html.length; i++) {
    if (html[i] === '{') {
      depth++;
    } else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return -1;
}

function transformHtml(html: string): string {
  const idx = html.indexOf(FUNC_START);
  if (idx === -1) {
    return html;
  }
  const braceIdx = html.indexOf('{', idx);
  const endIdx = findFunctionEnd(html, braceIdx);
  if (endIdx === -1) {
    return html;
  }
  return html.slice(0, idx) + INJECTED_IMPL + html.slice(endIdx);
}

export function htmlTransformMiddleware(htmlDir: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (req.method !== 'GET' || (req.path !== '/' && req.path !== '/index.html')) {
      next();
      return;
    }
    try {
      const filePath = path.join(htmlDir, 'index.html');
      const html = await readFile(filePath, 'utf8');
      const transformed = transformHtml(html);
      res.type('html').send(transformed);
    } catch (err) {
      next(err);
    }
  };
}
