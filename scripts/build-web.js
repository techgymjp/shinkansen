// Android アプリ (と Vercel) に載せる Web ファイルを www/ にコピーする
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'css', 'js', 'vendor', 'fonts']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// アプリ用のビルド (APP_BUILD=1, npm run build:app) では、Web 版だけの部分を取り除く。
// Google Play へのリンクや撮影用のフックがアプリに入っていると、App Store の審査で
// 「審査中に隠した機能」(Guideline 5.6) とみなされることがあるため。
// 目印: HTML は <!-- web-only --> … <!-- /web-only -->、JS は // web-only:start … // web-only:end、CSS は /* web-only:start */ … /* web-only:end */
const appBuild = process.env.APP_BUILD === '1';
if (appBuild) {
  const MARKS = [
    /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
    /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
    /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
  ];
  const FORBIDDEN = ['play.google.com', 'web-only', '__dbg'];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'vendor' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]);
  for (const file of walk(out).filter((f) => /\.(html|js|css)$/.test(f))) {
    let text = fs.readFileSync(file, 'utf8');
    for (const re of MARKS) text = text.replace(re, '');
    const bad = FORBIDDEN.filter((w) => text.includes(w));
    if (bad.length) {
      console.error(`アプリ用のビルドに Web 版だけの部分が残っています: ${path.relative(out, file)} (${bad.join(', ')})`);
      process.exit(1);
    }
    fs.writeFileSync(file, text);
  }
}
// Google Play・App Store 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${appBuild ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
