// 构建纯前端静态试玩版：
//   node build-static.js [artifact输出路径]
// 产物：
//   docs/index.html  — 完整独立页面（可直接双击打开 / 挂 GitHub Pages）
//   [artifact输出路径] — 去掉 doctype/html/head/body 外壳的版本（发布 Artifact 用）

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'engine-local.js'), 'utf8');
let app = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');

// 去掉依赖后端的 api()，由本地引擎提供同名函数
const A = '// [build:api-start]';
const B = '// [build:api-end]';
const ai = app.indexOf(A);
const bi = app.indexOf(B);
if (ai === -1 || bi === -1) throw new Error('app.js 缺少 build 标记');
app = app.slice(0, ai) + app.slice(bi + B.length);

// 取 <body> 内的标记（去掉外壳与脚本引用），并加试玩版说明
const bodyMarkup = html
  .replace(/^[\s\S]*?<body>/, '')
  .replace(/<\/body>[\s\S]*$/, '')
  .replace('<script src="app.js"></script>', '')
  .replace(
    '你可以逐条复验历史结果。',
    '你可以逐条复验历史结果。<br><b>本页为纯前端试玩版：serverSeed 在你的浏览器本地生成与保存；正式上线时种子由服务端持有，机制不变。</b>'
  )
  .trim();

const themeScript =
  "try{var t=localStorage.getItem('zero-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){document.documentElement.dataset.theme='dark'}";

const title = 'ZERO · 线上评级卡开包（试玩版）';
const js = engine + '\n' + app;

// 完整独立版
const standalone = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script>${themeScript}</scr` + `ipt>
<style>
${css}
</style>
</head>
<body>
${bodyMarkup}
<script>
${js}
</scr` + `ipt>
</body>
</html>
`;

fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), standalone);
console.log('docs/index.html 已生成,', standalone.length, '字节');

// Artifact 版（无外壳）
const artifactOut = process.argv[2];
if (artifactOut) {
  const artifact = `<title>${title}</title>
<script>${themeScript}</scr` + `ipt>
<style>
${css}
</style>
${bodyMarkup}
<script>
${js}
</scr` + `ipt>
`;
  fs.writeFileSync(artifactOut, artifact);
  console.log(artifactOut, '已生成,', artifact.length, '字节');
}
