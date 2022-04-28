import * as vscode from 'vscode';
import GistApi from './api/gistServer';
import { AnyTreeDataProvider } from './tree/gistTreeDataProvider';
import { GistCommentTreeItem, GistFileTreeItem, GistTreeItem } from './tree/gistTreeItem';
import path = require('path');
import localize from "./localize";
import { Gist } from './api/gitBase';
var pluginName: string = "ldgGist";
const gist = new GistApi();
//用于判断Token是否被修改
var lastToken: string = '';
export function activate(context: vscode.ExtensionContext) {
	console.log(`${pluginName}  activate`);
	registerCommand(context, "login", setToken);
	registerCommandOneArg(context, "selectedGist", async (id: string) => {
		if (gist.currId === id) { return; }
		gist.currId = id; gist.getCommits(); gist.getComments();
	});
	registerCommand(context, "openCode", async (args: any[]) => { 
		gist.createTextEditor(args); 
		let gistInfo = args[0] as Gist;
		if(!gistInfo.public){
			vscode.commands.executeCommand(`${pluginName}.selectedGist`, args[0].id);
		}
	});
	registerCommandOneArg(context, "createFromFile", async ({ fsPath: path }) => gist.createByFile(path));
	registerCommandOneArg(context, "createFromSelect", async ({ fsPath: path }) => gist.createBySelect());

	registerCommandOneArg(context, "addFromFile", async ({ fsPath: path }) => gist.addByFile(path));
	registerCommandOneArg(context, "addFromSelect", async () => gist.addBySelect());

	registerCommand(context, "saveGistFile", async () => gist.edit());
	registerCommandOneArg(context, "delete", async (item: GistTreeItem) => gist.delete(item));
	registerCommandOneArg(context, "deleteFile", async (item: GistFileTreeItem) => gist.deleteFile(item));

	registerCommand(context, "refreshGists", async () => gist.getList());
	registerCommand(context, "refreshPublicGists", async () => gist.getPublicList());

	registerCommand(context, "createComment", async () => gist.addComment());
	registerCommandOneArg(context, "editComment", async (item: GistCommentTreeItem) => gist.editComment(<string>item.id, <string>item.label));
	registerCommandOneArg(context, "deleteComment", async (item: GistCommentTreeItem) => gist.deleteComment(<string>item.id,<string>item.label));

	vscode.window.registerTreeDataProvider('gists', gist.gistTreeDataProvider);
	vscode.window.registerTreeDataProvider('publicGists', gist.publicGistTreeDataProvider);
	gist.gistCommits = registerTreeDataProvider('commits');
	gist.gistComments = registerTreeDataProvider('comments');

	vscode.commands.executeCommand(`${pluginName}.refreshGists`);
	vscode.commands.executeCommand(`${pluginName}.refreshPublicGists`);

}

export function deactivate() { }

async function checkConfig() {
	let token = <string>vscode.workspace.getConfiguration(pluginName).get('accessToken');
	if (!token) {
		vscode.window.showInformationMessage(localize(`${pluginName}.noTokenMsg`));
		return await setToken();
	}
	checkType(token);
	return true;
}
async function setToken(): Promise<boolean> {
	const token = await vscode.window.showInputBox({ placeHolder: localize(`${pluginName}.fillToken`), value: lastToken });
	if (token) {
		try {
			await vscode.workspace.getConfiguration(pluginName).update('accessToken', token,vscode.ConfigurationTarget.Global);
			checkType(token);
			vscode.commands.executeCommand(`${pluginName}.refreshGists`); vscode.commands.executeCommand(`${pluginName}.refreshPublicGists`); 
			return true;
		} catch (error:any) {
			vscode.window.showWarningMessage(error.message);
		}
	}
	return false;
}
async function checkType(token: string) {
	if (lastToken !== token) {
		lastToken = token;
		gist.upToken(lastToken);
		vscode.commands.executeCommand('setContext', `${pluginName}.tokenType`, gist.tokenType);
	}
}
function registerCommand(context: vscode.ExtensionContext, name: string, callback: (...args: any[]) => any) {
	let disposable = vscode.commands.registerCommand(`${pluginName}.${name}`, async (...args: any) => {
		if (name === "login" || await checkConfig()) {
			callback(args);
		}
	});
	context.subscriptions.push(disposable);
}
function registerCommandOneArg(context: vscode.ExtensionContext, name: string, callback: (arg: any) => any) {
	let disposable = vscode.commands.registerCommand(`${pluginName}.${name}`, async (arg: any) => {
		if (name === "login" || await checkConfig()) {
			callback(arg);
		} 
	});
	context.subscriptions.push(disposable);
}
/**
 * 注册数据提供者
 * @param {string} id 数据提供者id
 * @return {*} 操作数据的对象
 */
function registerTreeDataProvider(id: string): AnyTreeDataProvider {
	var itemData: Array<any> = [];
	var changeEvent = new vscode.EventEmitter();

	vscode.window.registerTreeDataProvider(id, {
		getTreeItem: (a: any) => a,
		getChildren: async (a: any) => itemData,
		onDidChangeTreeData: changeEvent.event
	});
	var r = {
		setData: (newData: Array<any>) => {
			itemData = newData;
			changeEvent.fire(null);
			return r;
		}
	};
	return r;
}
