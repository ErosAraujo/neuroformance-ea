const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

function copyFile(name) {
  const from = path.join(publicDir, name);
  const to = path.join(distDir, name);

  if (!fs.existsSync(from)) {
    console.warn(`[PWA] Arquivo não encontrado em public: ${name}`);
    return;
  }

  fs.copyFileSync(from, to);
  console.log(`[PWA] Copiado: ${name}`);
}

if (!fs.existsSync(distDir)) {
  throw new Error("[PWA] Pasta dist não encontrada. Rode expo export antes.");
}

copyFile("manifest.webmanifest");
copyFile("icon.png");
copyFile("icon-192.png");
copyFile("icon-512.png");
copyFile("apple-touch-icon.png");
copyFile("sw.js");

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");

  const tags = `
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="theme-color" content="#020817">
  `;

  if (!html.includes('rel="manifest"')) {
    html = html.replace("</head>", `${tags}\n</head>`);
    fs.writeFileSync(indexPath, html, "utf8");
    console.log("[PWA] Manifest e ícones injetados no index.html");
  } else {
    console.log("[PWA] Manifest já estava no index.html");
  }
}
