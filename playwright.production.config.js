import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testDir:'./tests/browser-production',use:{...base.use,baseURL:'http://localhost:4182'},webServer:{command:'node server/index.js',url:'http://localhost:4182/health',env:{PORT:'4182',LIBRARY_DIR:'.data/production-test-library'},reuseExistingServer:false}});
