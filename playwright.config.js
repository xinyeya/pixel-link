import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const chrome=process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:'http://localhost:4181',launchOptions:{...(existsSync(chrome)?{executablePath:chrome}:{}),args:['--autoplay-policy=no-user-gesture-required']},headless:true},timeout:45000,workers:1,webServer:{command:'node server/index.js --dev',url:'http://localhost:4181/health',env:{PORT:'4181',LIBRARY_DIR:'.data/browser-test-library',LIBRARY_ADMIN_TOKEN:'browser-test-only'},reuseExistingServer:false}});
