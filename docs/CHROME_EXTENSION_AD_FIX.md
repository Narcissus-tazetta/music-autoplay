# Chrome Extension 広告対応修正ガイド

## 概要

広告中の進捗バーが黄色く表示されない問題を解決するため、Chrome Extension側で以下の2つの修正を実施してください。

## 修正内容

### 1. 広告中もprogress_updateを送信する

**ファイル**: `content.ts`\
**場所**: `AdDetector`クラスの`checkVideoAndSendProgress`メソッド

#### 修正前

```typescript
private checkVideoAndSendProgress(): void {
  if (!this.videoElement || this.isAdCurrently) return;  // ← この行を修正

  const { currentTime, duration } = this.videoElement;
  // ...
}
```

#### 修正後

```typescript
private checkVideoAndSendProgress(): void {
  if (!this.videoElement) return;  // 広告チェックを削除

  const { currentTime, duration } = this.videoElement;
  // 以降は変更なし
}
```

**理由**: 広告中もサーバーに進捗情報を送信することで、UIが広告の進行状況を正しく表示できるようになります。

---

### 2. youtube_video_state送信時に広告状態をマークする

**ファイル**: `content.ts`\
**場所**: `attachVideoListeners`関数内の`notifyState`関数

#### 修正前

```typescript
const notifyState = (state: string) => {
    try {
        const currentTime = video.currentTime ?? null;
        const duration = video.duration ?? null;
        console.debug('[Content] notifyState', { state, currentTime, duration });
        chrome.runtime.sendMessage({
            type: 'youtube_video_state',
            url: location.href,
            state,
            currentTime,
            timestamp: Date.now(),
        });
        if (state === 'ended') chrome.storage.local.set({ latestUrl: 'ended' });
    } catch {
        return;
    }
};
```

#### 修正後

```typescript
const notifyState = (state: string) => {
    try {
        const currentTime = video.currentTime ?? null;
        const duration = video.duration ?? null;
        const isAd = adDetector.getCurrentAdState(); // 追加
        console.debug('[Content] notifyState', {
            state,
            currentTime,
            duration,
            isAd,
        }); // 修正
        chrome.runtime.sendMessage({
            type: 'youtube_video_state',
            url: location.href,
            state,
            currentTime,
            timestamp: Date.now(),
            isAdvertisement: isAd, // 追加
        });
        if (state === 'ended') chrome.storage.local.set({ latestUrl: 'ended' });
    } catch {
        return;
    }
};
```

**理由**: サーバー側で広告中に送信された`youtube_video_state`イベントを識別し、無視できるようにします。これにより、広告終了後31秒遅れで届く`playing`イベントが広告状態を上書きする問題を防ぎます。

---

## サーバー側の対応済み修正

以下の修正は既にサーバー側で完了しています:

### 1. 広告状態マークされたyoutube_video_stateの無視

**ファイル**: `src/server/socket/handlers/extensionEventHandlers.ts`

```typescript
// Extension側で広告中とマークされたイベントは完全に無視
if (isAdvertisement) {
    log.debug(
        'youtube_video_state: ignoring event marked as advertisement by extension',
        {
            state: stateRaw,
            url,
        },
    );
    return;
}
```

### 2. 時間窓ベースの保護ロジックの削除

広告開始から500msの保護窓では不十分だったため、Extension側のフラグベースの判定に完全移行しました。

### 3. クライアント側の状態リセットタイミング調整

**ファイル**: `src/shared/hooks/usePlayerState.ts`

- 広告終了時(true→false): 状態を完全リセット
- 広告開始時(false→true): リセットせずrefのみ更新

これにより、広告開始時に時間がリセットされず、広告終了時のみスムーズに本編に戻ります。

---

## 期待される動作

修正後は以下のように動作します:

1. **広告開始時**:
   - 進捗バーが黄色に変化
   - 広告の進行状況が表示される
   - 時間はリセットされない

2. **広告中**:
   - 1秒ごとに`progress_update`が送信される
   - UIが広告の進捗を継続的に更新
   - 遅延した`youtube_video_state`イベントは無視される

3. **広告終了時**:
   - 進捗バーが緑に戻る
   - 時間がリセットされ、本編の再生位置から再開
   - UIが本編の状態に切り替わる

---

## 検証方法

1. YouTube動画で広告が表示される動画を再生
2. 広告中に進捗バーが黄色になることを確認
3. 広告の進行状況(currentTime/duration)が更新されることを確認
4. 広告終了後、進捗バーが緑に戻り本編が再生されることを確認

---

## 関連ファイル

- Chrome Extension: `content.ts`
- Server: `src/server/socket/handlers/extensionEventHandlers.ts`
- Client: `src/shared/hooks/usePlayerState.ts`
- Types: `src/shared/stores/musicStore.ts`
