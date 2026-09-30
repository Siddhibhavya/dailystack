import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const env = { ...process.env };
// Use Java from PATH, or a locally installed development JDK; never change system settings.
if (process.platform === 'win32' && env.LOCALAPPDATA) {
  const tools = join(env.LOCALAPPDATA, 'MyLifeTools');
  if (existsSync(tools)) {
    const jdk = readdirSync(tools).find(name => name.startsWith('jdk-21') && existsSync(join(tools, name, 'bin', 'java.exe')));
    if (jdk) { env.JAVA_HOME = join(tools, jdk); const key = Object.keys(env).find(k => k.toLowerCase() === 'path') ?? 'PATH'; env[key] = `${join(env.JAVA_HOME, 'bin')};${env[key] ?? ''}`; }
  }
}
// The demo- project can never route these tests into the user's production database.
const args = ['emulators:exec', '--config', 'firebase.emulators.json', '--project', 'demo-my-life', '--only', 'auth,firestore', 'npm run test:emulator:unit'];
const windowsCli = env.APPDATA && join(env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const child = process.platform === 'win32' && windowsCli && existsSync(windowsCli)
  ? spawn(process.execPath, [windowsCli, ...args], { env, stdio: 'inherit' })
  : spawn('firebase', args, { env, stdio: 'inherit' });
child.on('error', () => { process.stderr.write('Firebase CLI and Java 21 are required for emulator tests.\n'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
