#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function usage() {
  console.error('Usage: node scripts/prepare-asar.js <version>');
}

function main() {
  const version = process.argv[2];
  if (!version) {
    usage();
    process.exit(1);
  }

  console.log(`\n🚀 Starting preparation for version ${version}\n`);

  const repoRoot = path.resolve(__dirname, '..');
  const inputDir = path.join(repoRoot, 'inputs', version);
  const inputAsar = path.join(inputDir, 'app.asar');
  const inputUnpacked = path.join(inputDir, 'app.asar.unpacked');

  // 检查输入文件
  if (!fs.existsSync(inputAsar)) {
    throw new Error(`❌ Missing app.asar at ${inputAsar}`);
  }
  if (!fs.existsSync(inputUnpacked)) {
    throw new Error(`❌ Missing app.asar.unpacked at ${inputUnpacked}`);
  }

  console.log('✅ Input files found');

  // 创建工作目录
  const workDir = fs.mkdtempSync(path.join(repoRoot, 'asar-work-'));
  const extractedDir = path.join(workDir, 'extracted');
  const outputDir = path.join(workDir, 'output');
  fs.mkdirSync(extractedDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`📁 Working directory: ${workDir}`);

  // 解包 app.asar
  console.log('\n📦 Extracting app.asar...');
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  try {
    execFileSync(npxCommand, ['--yes', 'asar', 'extract', inputAsar, extractedDir], { 
      stdio: 'inherit', 
      shell: true 
    });
    console.log('✅ Extraction complete');
  } catch (error) {
    throw new Error(`❌ Failed to extract app.asar: ${error.message}`);
  }

  // 复制 unpacked 文件（不覆盖已存在文件）
  console.log('\n📁 Copying unpacked files (preserve existing contents)...');
  try {
    const copyPreserve = (source, destination) => {
      const entries = fs.readdirSync(source, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyPreserve(srcPath, destPath);
          continue;
        }

        if (fs.existsSync(destPath)) {
          continue;
        }

        fs.copyFileSync(srcPath, destPath);
      }
    };

    copyPreserve(inputUnpacked, extractedDir);
    console.log('✅ Unpacked files copied');
  } catch (error) {
    throw new Error(`❌ Failed to copy unpacked files: ${error.message}`);
  }

  // 查找并替换 preload.js
  console.log('\n🔍 Looking for preload.js in dist directory...');
  let targetPreload = path.join(extractedDir, 'dist', 'preload.js');
  
  if (!fs.existsSync(targetPreload)) {
    // 尝试其他可能的位置
    const alternativePaths = [
      path.join(extractedDir, 'dist', 'statics', 'js', 'preload.js'),
      path.join(extractedDir, 'preload.js'),
    ];
    
    let found = false;
    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        console.log(`✅ Found preload.js at: ${altPath.replace(extractedDir, '')}`);
        targetPreload = altPath;
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error(`❌ Cannot find preload.js in expected locations`);
    }
  } else {
    console.log('✅ Found preload.js at: /dist/preload.js');
  }

  // 替换 preload.js
  const projectPreload = path.join(repoRoot, 'preload.js');
  if (!fs.existsSync(projectPreload)) {
    throw new Error(`❌ Project preload.js not found at: ${projectPreload}`);
  }

  console.log('\n📝 Appending Chinese translation to preload.js...');
  try {
    // 先备份原文件（可选）
    const backupPath = targetPreload + '.original';
    fs.copyFileSync(targetPreload, backupPath);
    console.log(`   💾 Original backed up to: ${backupPath.replace(extractedDir, '')}`);

    // 追加翻译内容
    const originalContent = fs.readFileSync(targetPreload, 'utf8');
    const translationContent = fs.readFileSync(projectPreload, 'utf8');
    const combinedContent = `${originalContent}\n\n${translationContent}`;
    fs.writeFileSync(targetPreload, combinedContent);
    console.log('✅ preload.js updated successfully!');

    // 验证文件
    const updatedContent = fs.readFileSync(targetPreload, 'utf8');
    if (updatedContent.includes('const i18n = {')) {
      console.log('✅ Verified: Chinese translation detected in updated file');
    } else {
      console.warn('⚠️  Warning: i18n block not detected, but file was replaced');
    }
  } catch (error) {
    throw new Error(`❌ Failed to replace preload.js: ${error.message}`);
  }

  // 重新打包
  console.log('\n📦 Repacking app.asar...');
  
  try {
    const unpackEntries = fs.readdirSync(inputUnpacked, { withFileTypes: true });
    const unpackDirs = unpackEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const unpackFiles = unpackEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    const outputAsar = path.join(outputDir, 'app.asar');
    const packArgs = ['--yes', 'asar', 'pack', extractedDir, outputAsar];

    // 添加需要保持 unpacked 的目录和文件
    for (const dir of unpackDirs) {
      packArgs.push('--unpack-dir', dir);
    }
    for (const file of unpackFiles) {
      packArgs.push('--unpack', file);
    }

    console.log(`   Unpacking ${unpackDirs.length} directories and ${unpackFiles.length} files`);
    execFileSync(npxCommand, packArgs, { stdio: 'inherit', shell: true });
    console.log('✅ Repacking complete');
  } catch (error) {
    throw new Error(`❌ Failed to repack app.asar: ${error.message}`);
  }

  // 复制到项目根目录
  console.log('\n💾 Copying final app.asar to project root...');
  const finalAsar = path.join(repoRoot, 'app.asar');
  const outputAsar = path.join(outputDir, 'app.asar');
  
  try {
    fs.copyFileSync(outputAsar, finalAsar);
    const stats = fs.statSync(finalAsar);
    console.log(`✅ Final app.asar created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    throw new Error(`❌ Failed to copy final asar: ${error.message}`);
  }

  // 清理临时文件
  console.log('\n🧹 Cleaning up temporary files...');
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.warn(`⚠️  Warning: Failed to cleanup temp directory: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Preparation complete successfully!');
  console.log('='.repeat(60));
  console.log(`\n📦 Output: ${finalAsar}`);
  console.log('🎉 Ready for building!\n');
}

// 主执行
try {
  main();
} catch (error) {
  console.error('\n' + '='.repeat(60));
  console.error('❌ ERROR: Preparation failed');
  console.error('='.repeat(60));
  console.error(`\n${error.message}\n`);
  
  if (error.stack) {
    console.error('Stack trace:');
    console.error(error.stack);
  }
  
  process.exit(1);
}
