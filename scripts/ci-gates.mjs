import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function getCiConfiguration(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  const packagePath = path.join(root, 'package.json');

  if (!fs.existsSync(packagePath)) {
    return {
      hasPackage: false,
      packagePath,
      commands: [],
      installCommand: null,
    };
  }

  const packageContents = fs.readFileSync(packagePath, 'utf8');
  const packageData = JSON.parse(packageContents);
  const scripts = packageData.scripts ?? {};

  const commandNames = ['lint', 'build', 'test', 'e2e'];
  const commands = commandNames.filter(
    (name) => typeof scripts[name] === 'string' && scripts[name].trim().length > 0
  );

  const hasLockfile = fs.existsSync(path.join(root, 'package-lock.json'))
    || fs.existsSync(path.join(root, 'npm-shrinkwrap.json'));
  const installCommand = hasLockfile ? ['npm', 'ci'] : ['npm', 'install'];

  return {
    hasPackage: true,
    packagePath,
    commands,
    installCommand,
  };
}

function runCommand(command, args, projectRoot) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status;
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

export function runCi(projectRoot = process.cwd()) {
  const config = getCiConfiguration(projectRoot);
  const skipInstall = process.env.CI_SKIP_INSTALL === '1';

  if (!config.hasPackage) {
    console.log('No package.json found. Skipping CI quality gates.');
    return { skipped: true, config };
  }

  if (!skipInstall && config.installCommand) {
    runCommand(config.installCommand[0], config.installCommand.slice(1), projectRoot);
  }

  for (const command of config.commands) {
    runCommand('npm', ['run', command], projectRoot);
  }

  return { skipped: false, config };
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url))) {
  runCi(process.cwd());
}
