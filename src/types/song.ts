import type { DownloadResult } from '../services/download';

export interface Song {
  id: string;
  title: string;
  author: string;
  album?: string;
  lyrics?: string;
  createdAt?: string;
  url?: string;
  cover?: string;
  receivedAt: string;
  download?: DownloadResult;
}

export type CreateSongInput = Omit<Song, 'id' | 'receivedAt' | 'download'>;
