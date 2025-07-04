import type { Music } from '../features/music/stores/musicStore';

/**
 * サーバー側の型定義
 */

/**
 * 接続されたクライアントの情報
 */
export interface ClientInfo {
    /** 接続時刻 */
    connectedAt: Date;
    /** ユーザーエージェント（オプション） */
    userAgent?: string;
    /** IPアドレス（オプション） */
    ipAddress?: string;
    /** その他のメタデータ */
    metadata?: Record<string, unknown>;
}

/**
 * YouTube状態情報（Socket.IOイベントデータと一致）
 */
export interface YouTubeStatus {
    state: string;
    url: string;
    match: boolean;
    music: Music | null;
}

/**
 * YouTube現在状態
 */
export interface YouTubeCurrentState {
    state: string;
    url: string;
}

/**
 * アプリケーション全体の状態
 */
export interface AppState {
    currentYoutubeState: YouTubeCurrentState;
    lastYoutubeStatus: YouTubeStatus | null;
    currentPlayingId: string | null;
}

/**
 * ログデータ型
 */
export type LogData = Record<string, unknown>;

/**
 * クライアントマップ型
 */
export type ClientsMap = Map<string, ClientInfo>;
