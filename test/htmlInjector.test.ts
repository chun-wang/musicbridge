import { describe, expect, it } from 'vitest';
import { transformHtml } from '../src/middlewares/htmlInjector';

const fixture = `    function handleDownloadCurrent(){
      window.open('x');
    }

    function toggleFavoriteCurrent(){
      state.favorites.push(state.currentTrack);
    }

    function isFavorite(track){
      return state.favorites.some(x=>x.uid===track.uid);
    }

    function init(){
      loadLibraryFromStorage();
    }`;

describe('transformHtml', () => {
  it('injects download implementation', () => {
    const out = transformHtml(fixture);
    expect(out).toContain('async function handleDownloadCurrent(){');
    expect(out).toContain("fetch('/api/songs'");
    expect(out).not.toContain("window.open('x')");
  });

  it('syncs favorites with the server on click', () => {
    const out = transformHtml(fixture);
    expect(out).toContain('async function toggleFavoriteCurrent(){');
    expect(out).toContain("fetch('/api/favorites/'+encodeURIComponent(tr.uid)");
    expect(out).toContain("fetch('/api/favorites',{");
  });

  it('loads favorites from the server on page load', () => {
    const out = transformHtml(fixture);
    expect(out).toContain('async function loadFavoritesFromServer(){');
    expect(out).toContain("fetch('/api/favorites')");
    expect(out).toContain(
      'loadLibraryFromStorage();loadFavoritesFromServer();',
    );
  });

  it('leaves html without anchor unchanged', () => {
    const html = 'function other(){ return 1; }';
    expect(transformHtml(html)).toBe(html);
  });
});
