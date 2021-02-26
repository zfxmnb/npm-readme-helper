import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const marked  = require('marked');
const childProcess = require('child_process');

/**
 * 预览markdown
 * @param readmeText md
 * @param moduleName 模块名
 */
const previewMarkdown = (readmeText: string, moduleName: string = '') => {
	// 创建webview
	const panel = vscode.window.createWebviewPanel(
		'testWebview', // viewType
		`${moduleName}/README.md`, // 视图标题
		vscode.ViewColumn.Beside, // 显示在编辑器的哪个部位
		{
			retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
		}
	);
	panel.webview.html = marked(readmeText);
};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.concat([
		vscode.languages.registerDefinitionProvider(['json'], {
			provideDefinition(document, position) {
				const fileName = document.fileName;
				const workDir = path.dirname(fileName);
				const word = document.getText(document.getWordRangeAtPosition(position));
				// 只处理package.json文件
				if (/\/package\.json$/.test(fileName)) {
					const json = document.getText();
					if (new RegExp(`"(dependencies|devDependencies)":\\s*?\\{[\\s\\S]*?${word.replace(/\//g, '\\/')}[\\s\\S]*?\\}`, 'gm').test(json)) {
						const packageName = word.replace(/"/g, '');
						const readmePath = `${workDir}/node_modules/${packageName}/README.md`;
						if (fs.existsSync(readmePath)) {
							return new vscode.Location(vscode.Uri.file(readmePath), new vscode.Position(0, 0));
						}
					}
				}
			}
		}),
		vscode.languages.registerHoverProvider('json', {
			provideHover(document, position) {
				const fileName = document.fileName;
				const workDir = path.dirname(fileName);
				const word = document.getText(document.getWordRangeAtPosition(position));

				if (/\/package\.json$/.test(fileName)) {
					const json = document.getText();
					if (new RegExp(`"(dependencies|devDependencies)":\\s*?\\{[\\s\\S]*?${word.replace(/\//g, '\\/')}[\\s\\S]*?\\}`, 'gm').test(json)) {
						const packageName = word.replace(/"/g, '');
						let destPath = `${workDir}/node_modules/${packageName}/package.json`;
						if (fs.existsSync(destPath)) {
							let content: Record<string, any> = {};
							let commentCommandUri;
							try {
								content = JSON.parse(fs.readFileSync(destPath, { encoding: 'utf-8' }));
								commentCommandUri = vscode.Uri.parse(`command:Commands.dependency.view.readme?${encodeURIComponent(JSON.stringify([workDir, content.name]))}`);
							} catch (err) {}
							
							let versions = [];
							try {
								versions = JSON.parse(childProcess.execSync(`npm view ${packageName} versions --json`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).toString().replace(/\n|\s/g, ''));
							} catch (err) {}

							const infoMD = new vscode.MarkdownString(`* **名称**：${content.name}\n* **描述**：${content.description}\n* **版本**：${content.version}\n* **许可协议**：${content.license} \n`);
							const versionMD = new vscode.MarkdownString(versions.reduce((p: string, version: string) => {
								return `${p} ${ p ? '|' : '' } [${version}](https://www.npmjs.com/package/${content.name}/v/${version})`;
							}, '') || '未找到历史版本');
							const actionsMD = new vscode.MarkdownString(`[NPM官网](https://www.npmjs.com/package/${content.name}) ｜ [预览README](${commentCommandUri})`);
							actionsMD.isTrusted = true;
							return new vscode.Hover([
								infoMD,
								actionsMD,
								versionMD
							]);
						} else {
							return new vscode.Hover([new vscode.MarkdownString(`[未找到 ${packageName} 模块](https://www.npmjs.com/package/${packageName})`)]);
						}
					}
				}
			}
		}),
		vscode.commands.registerCommand('Commands.dependency.readme.extension', ({ fsPath }) => {
			const readmeText = fs.readFileSync(fsPath, { encoding: 'utf-8' });
			readmeText && previewMarkdown(readmeText);
		}),
		vscode.commands.registerCommand('Commands.dependency.readme', () => {
			const readmeText = vscode.window.activeTextEditor?.document.getText();
			readmeText && previewMarkdown(readmeText);
		}),
		vscode.commands.registerCommand('Commands.dependency.view.readme', (workDir, packageName) => {
			const readmePath = `${workDir}/node_modules/${packageName}/README.md`;
			const readmeText = fs.readFileSync(readmePath, { encoding: 'utf-8' });
			readmeText && previewMarkdown(readmeText, packageName);
		})
	]);
}

// this method is called when your extension is deactivated
export function deactivate() {}