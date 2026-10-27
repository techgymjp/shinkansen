// Android / iOS アプリ (Capacitor) のネイティブ機能。Web 版では Capacitor がないので何もしない
const cap = window.Capacitor;
export const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const plugins = isNative && cap.Plugins ? cap.Plugins : {};

// 戻るボタン (Android のみ。iOS には戻るボタンがないので呼ばれない)
export function onBackButton(handler) {
  if (plugins.App) plugins.App.addListener('backButton', handler);
}

export function exitApp() {
  if (plugins.App) plugins.App.exitApp();
}

// Android / iOS の共有メニューを出す。使えなければ false
export async function shareNative({ title, text, url, dialogTitle }) {
  if (plugins.Share) {
    try {
      await plugins.Share.share({ title, text, url, dialogTitle });
    } catch (e) {
      // 共有メニューを閉じただけのときもここに来る
    }
    return true;
  }
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); } catch (e) { /* キャンセル */ }
    return true;
  }
  return false;
}

export const canShareNative = () => !!plugins.Share || !!navigator.share;
