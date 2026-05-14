import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

// Inicializa variáveis de ambiente do .env local (útil para desenvolvimento)
// No build de produção, as VITE_ serão imbutidas, mas podemos tentar carregar se existir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "StockFlowPro V2.0",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Remove o menu padrão do sistema
  win.removeMenu();
  
  // Abre a janela maximizada em tela cheia
  win.maximize();

  // Dependendo do ambiente, carrega o build final ou o servidor de dev
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
    win.setTitle("StockFlowPro V2.0");
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
