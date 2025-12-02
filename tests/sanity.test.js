import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Project Structure Sanity Checks', () => {
    test('README.md should exist', () => {
        const readmePath = path.join(__dirname, '../README.md');
        expect(fs.existsSync(readmePath)).toBe(true);
    });

    test('package.json should exist and have scripts', () => {
        const packageJsonPath = path.join(__dirname, '../package.json');
        expect(fs.existsSync(packageJsonPath)).toBe(true);
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        expect(packageJson.scripts).toBeDefined();
        expect(packageJson.scripts.start).toBeDefined();
    });

    test('server.js should exist', () => {
        const serverPath = path.join(__dirname, '../server.js');
        expect(fs.existsSync(serverPath)).toBe(true);
    });

    test('public directory should exist', () => {
        const publicPath = path.join(__dirname, '../public');
        expect(fs.existsSync(publicPath)).toBe(true);
    });
});
