#! /usr/bin/env node --experimental-network-imports --experimental-fetch
import {Command} from 'commander';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import archiver from 'archiver';
import {DatabaseArray, setServerUrl, setApiKey} from '@jsdb/sdk';

const bundles = new DatabaseArray('bundles');
const program = new Command();

program
  .name('JSDB CLI')
  .description('JSDB CLI')
  .version('0.0.2');

program.command('init')
  .description('Initializes the .jsdb file structure')
  .option('--projectPath <projectPath>', 'Path to where you want to initialize JSDB', process.cwd())
  .action(async ({projectPath}) => {
    const jsdbPath = path.resolve(projectPath, '.jsdb');
    try {
      await fsPromises.stat(jsdbPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('Creating folder');
        await fsPromises.mkdir(jsdbPath);
        await fsPromises.mkdir(path.resolve(jsdbPath, 'db'));
        await fsPromises.mkdir(path.resolve(jsdbPath, 'db/default'));
        await fsPromises.writeFile(path.resolve(jsdbPath, 'db/default/rules.js'), `export default () => true; //This allows all operations. Change to false in production`)
        await fsPromises.mkdir(path.resolve(jsdbPath, 'functions'));
        await fsPromises.writeFile(path.resolve(jsdbPath, 'functions/helloWorld.js'), `export default ({data}) => ({message:'echo!!', echoedData: data}); //This allows all operations. Change to false in production`)

        await fsPromises.mkdir(path.resolve(jsdbPath, 'hosting'));
        await fsPromises.writeFile(path.resolve(jsdbPath, 'hosting/index.html'),
          `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>JSDB Project</title>
</head>
<body>
    Add your static files to the /.jsdb/hosting folder
</body>
</html>
`);

        process.exit(0)
      }
    }
    console.log('.jsdb folder already exists');
    process.exit(0)
  })

program.command('deploy')
  .description('Deploy to your JSDB Server')
  .option('--bundlePath <bundlePath>', 'Path to .jsdb folder', path.resolve(process.cwd(), '.jsdb'))
  .requiredOption('--serverUrl <serverUrl>', 'JavascriptDB Server Url')
  .requiredOption('--apiKey <apiKey>', 'API Key')
  .action(async ({bundlePath, serverUrl, apiKey}) => {
    if (fs.existsSync(bundlePath)) {
      setApiKey(apiKey);
      setServerUrl(serverUrl);
      const compressedBundlePath = path.resolve(process.cwd(), './jsdbbundle.zip');
      console.log('Bundling .jsdb folder.');
      const size = await zipDirectory(bundlePath, compressedBundlePath);
      console.log('Deploying Bundle.');
      const result = await saveBundle(compressedBundlePath);
      console.log('Done.');
    } else {
      throw new Error(`Folder ${bundlePath} doesn't exist.`)
    }
  });

program.parse();

async function saveBundle(source) {
  const file = await fsPromises.readFile(source);
  await bundles.push({
    date: new Date(),
    file
  });
}

async function zipDirectory(source, dest) {
  const stream = fs.createWriteStream(dest);
  const archive = archiver('zip', {zlib: {level: 9}});

  archive.on('error', function (err) {
    throw err;
  });


  return new Promise((resolve) => {
    archive.pipe(stream);
    archive.directory(source, false);
    archive.on('error', err => {
      throw err;
    });
    archive.finalize();

    stream
      .on('close', function () {
        console.log(`Bundled ${archive.pointer()} total bytes.`);
        resolve(archive.pointer());
      });
  });
}