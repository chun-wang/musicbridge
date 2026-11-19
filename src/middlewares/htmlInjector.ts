import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const INJECTED_DOWNLOAD_IMPL = `    async function handleDownloadCurrent(){
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

const INJECTED_TOGGLE_FAVORITE_IMPL = `    async function toggleFavoriteCurrent(){
      const tr=state.currentTrack; if(!tr)return;
      const wasFav=isFavorite(tr);
      const i=state.favorites.findIndex(x=>x.uid===tr.uid);
      if(i>=0){state.favorites.splice(i,1);showToast(t('toastRemovedFavorite'));}
      else{state.favorites.push(tr);showToast(t('toastAddedFavorite'));}
      updateMainFavButton();
      renderPlaylistList();
      saveLibraryToStorage();
      try{
        const res=wasFav
          ? await fetch('/api/favorites/'+encodeURIComponent(tr.uid),{method:'DELETE'})
          : await fetch('/api/favorites',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify(serializeTrack(tr)||{uid:tr.uid})
            });
        if(!res.ok) throw new Error('HTTP '+res.status);
        const j=await res.json();
        const list=j&&j.data&&Array.isArray(j.data.favorites)?j.data.favorites:null;
        if(list){
          state.favorites=list.map(deserializeTrack).filter(Boolean);
          rebuildLibraryTrackMap();
          saveLibraryToStorage();
          updateMainFavButton();
          renderPlaylistList();
        }
      }catch(e){
        console.error('sync favorite with server failed',e);
        showToast(state.language==='zh'?'收藏同步失败':'Failed to sync favorite');
        const j=state.favorites.findIndex(x=>x.uid===tr.uid);
        if(wasFav&&j<0)state.favorites.push(tr);
        if(!wasFav&&j>=0)state.favorites.splice(j,1);
        saveLibraryToStorage();
        updateMainFavButton();
        renderPlaylistList();
      }
    }`;

const INJECTED_LOAD_FAVORITES_IMPL = `    async function loadFavoritesFromServer(){
      try{
        const res=await fetch('/api/favorites');
        if(!res.ok) throw new Error('HTTP '+res.status);
        const j=await res.json();
        const list=j&&j.data&&Array.isArray(j.data.favorites)?j.data.favorites:[];
        state.favorites=list.map(deserializeTrack).filter(Boolean);
        rebuildLibraryTrackMap();
        updateMainFavButton();
        renderPlaylistList();
      }catch(e){
        console.error('load favorites from server failed',e);
      }
    }`;

const FAVORITES_ANCHOR = 'function isFavorite(track){';
const INIT_LOAD_CALL = 'loadLibraryFromStorage();';

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

function replaceFunction(html: string, name: string, impl: string): string {
  const marker = `function ${name}(`;
  let idx = html.indexOf(marker);
  if (idx === -1) {
    return html;
  }
  const braceIdx = html.indexOf('{', idx);
  if (braceIdx === -1) {
    return html;
  }
  const endIdx = findFunctionEnd(html, braceIdx);
  if (endIdx === -1) {
    return html;
  }
  if (html.slice(Math.max(0, idx - 6), idx) === 'async ') {
    idx -= 6;
  }
  return html.slice(0, idx) + impl + html.slice(endIdx);
}

export function transformHtml(html: string): string {
  let out = replaceFunction(html, 'handleDownloadCurrent', INJECTED_DOWNLOAD_IMPL);
  out = replaceFunction(out, 'toggleFavoriteCurrent', INJECTED_TOGGLE_FAVORITE_IMPL);

  if (out.includes(FAVORITES_ANCHOR)) {
    out = out.replace(
      FAVORITES_ANCHOR,
      `${INJECTED_LOAD_FAVORITES_IMPL}\n    ${FAVORITES_ANCHOR}`,
    );
    out = out.replace(
      INIT_LOAD_CALL,
      `${INIT_LOAD_CALL}loadFavoritesFromServer();`,
    );
  }

  return out;
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
