import {
    Uri,
    window,
    Position,
    QuickPick,
    workspace,
    QuickPickItem,
    Range,
    Progress,
    ProgressLocation,
    TextEditor,
} from "vscode";

import Gitee from "./gitee";
import Github from "./github";
import { GitBase, GistFiles, Gist, GistFile } from "./gitBase";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AnyTreeDataProvider, GistTreeDataProvider } from "../tree/gistTreeDataProvider";
import { GistCommentTreeItem, GistCommitTreeItem, GistFileTreeItem, GistTreeItem } from "../tree/gistTreeItem";
import localize from "../localize";


interface Action {
    (item: QuickPickItemAction): void;
}

interface QuickPickItemAction extends QuickPickItem {
    action: Action;
}

export default class GistServer {
    private pluginName: string = "ldgGist";
    private cache: string = `${os.homedir()}/.vscodeGist`;
    private quickPick: QuickPick<QuickPickItemAction> = window.createQuickPick();
    private limit: number = 20;
    private gitee: GitBase = new Gitee();
    private github: GitBase = new Github();
    public gistTreeDataProvider: GistTreeDataProvider = new GistTreeDataProvider();
    public publicGistTreeDataProvider: GistTreeDataProvider = new GistTreeDataProvider();
    public gistCommits: AnyTreeDataProvider | undefined;
    public gistComments: AnyTreeDataProvider | undefined;
    public tokenType: string = "gitee";
    public currId: string = "";
    private lastFile: string = '';
    private since:string='';
    constructor() {
        try {
            fs.accessSync(this.cache, fs.constants.F_OK);
        } catch (error) {
            fs.mkdirSync(this.cache);
        }

        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        this.quickPick.busy = false;

        this.quickPick.onDidAccept(async () => {
            const item = this.quickPick.selectedItems[0];
            if (!this.quickPick.busy && item.action) {
                this.quickPick.busy = true;
                await item.action(item);
            }
        });
    }

    get api(): GitBase {
        switch (this.tokenType) {
            case "gitee": return this.gitee;
            case "github": return this.github;
            default: return this.gitee;
        }
    }
    public upToken(token: string): void {
        if (token.length === 32) {
            this.tokenType = 'gitee';
        } else {
            this.tokenType = 'github';
        }
        this.api.token = token;
    }

    /**
     * 使用选中内容创建一个代码片段
     */
    public async createBySelect() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${this.pluginName}.noSelected`));
            return;
        }
        const description = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.gistDescription`) }) || "";
        const fileName = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.fileName`) }) || "";
        const ispublic = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.isPublic`) }) || "";
        await this.create(description, fileName, edit.document.getText(edit.selection), ispublic);
    }

    /**
     * 从文件创建一个代码片段
     * @param filePath 文件路径
     */
    public async createByFile(filePath: string) {
        try {
            const content = (await fs.promises.readFile(filePath)).toString();
            if (content === "") {
                window.showErrorMessage(localize(`${this.pluginName}.fileContentEmptyError`));
                return;
            }
            const description = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.gistDescription`) }) || "";
            const ispublic = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.isPublic`) }) || "";
            await this.create(description, path.basename(filePath), content, ispublic);
        } catch (error) {
            window.showErrorMessage(localize(`${this.pluginName}.upFileError`, filePath, <string>error));
        }
    }

    /**
     * 将选中内容添加到已有的代码片段
     */
    public async addBySelect() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${this.pluginName}.noSelected`));
            return;
        }
        const fileName = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.fileName`) }) || "";
        await this.add(fileName, edit.document.getText(edit.selection));
    }

    /**
     * 将文件添加到已有的代码片段
     * @param filePath 文件路径
     */
    public async addByFile(filePath: string) {

        try {
            const content = (await fs.promises.readFile(filePath)).toString();
            if (content === "") {
                window.showErrorMessage(localize(`${this.pluginName}.fileContentEmptyError`));
                return;
            }
            await this.add(path.basename(filePath), content);
        } catch (error) {
            window.showErrorMessage(localize(`${this.pluginName}.upFileError`, filePath, <string>error));
        }
    }

    /**
     * 删除一个代码片段
     */
    public async delete(element: GistTreeItem) {
        const result = await window.showWarningMessage(localize(`${this.pluginName}.gistDeleteConfirm`, <string>element.label), localize(`${this.pluginName}.confirm`), localize(`${this.pluginName}.cancel`));
        if (result !== localize(`${this.pluginName}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistDeleteProgress`, <string>element.label), async () => {
            try {
                await this.api.delete(element.id || "");
                window.setStatusBarMessage(localize(`${this.pluginName}.gistDeleteSuccess`, <string>element.label),3000);
                this.gistTreeDataProvider.removeGist(<string>element.id);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistDeleteError`, <string>element.label, <string>error));
            }
        });

    }

    /**
     * 删除代码片段中的一个文件
     */
    public async deleteFile(element: GistFileTreeItem) {
        const fileName = <string>element.label;
        const result = await window.showWarningMessage(localize(`${this.pluginName}.gistFileDeleteConfirm`, <string>element.gist.description, <string>fileName), localize(`${this.pluginName}.confirm`), localize(`${this.pluginName}.cancel`));
        if (result !== localize(`${this.pluginName}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistFileDeleteProgress`, <string>element.gist.description, <string>fileName), async () => {
            try {
                await this.api.deleteFile(element.gist.id || "", fileName);
                window.setStatusBarMessage(localize(`${this.pluginName}.gistFileDeleteSuccess`, <string>element.gist.description, <string>fileName),3000);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistFileDeleteError`, <string>element.gist.description, <string>fileName, <string>error));
            }
        });
    }
    /**
     * 获取最近更新的代码片段
     */
    public async getNew() {
        this.getList(1,this.since);
    }
    /**
     * 获取个人的代码片段
     */
    public async getList(page: number = 1,since: string = "") {
        this.executeCommandWithProgress(localize(`${this.pluginName}.getListProgress`, page.toString(), localize(`${this.pluginName}.gists`)), async () => {
            try {
                let gistList = await this.api.getList(this.limit, page, since);
                if (gistList.length > 0) {
                    gistList.map(gist => {
                        if(<string>gist.updated_at>this.since){
                            this.since=<string>gist.updated_at;
                        }
                    });
                }
                if (page === 1) {
                    this.currId = '';
                }
                if(since!=='')
                {
                    this.gistTreeDataProvider.insertData(gistList,false);
                }else{
                    if (page === 1) {
                        this.gistTreeDataProvider.setData(gistList, false);
                    } else {
                        this.gistTreeDataProvider.appendData(gistList, false);
                    }
                }
                if (gistList.length === this.limit) {
                    this.getList((page + 1),since);
                }

            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.getListError`, page.toString(), localize(`${this.pluginName}.gists`), <string>error));
            }
        });
    }
    /**
     * 获取公开的代码片段
     */
    public async getPublicList(page: number = 1) {
        if (this.tokenType === "gitee") {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.getListProgress`, page.toString(), localize(`${this.pluginName}.publicGists`)), async () => {
            try {
                let gistList = await this.api.getPublicList(this.limit, page);
                if (page === 1) {
                    this.publicGistTreeDataProvider.setData(gistList, true);
                } else {
                    this.publicGistTreeDataProvider.appendData(gistList, true);
                }
                if (gistList.length === this.limit) {
                    //this.getPublicList((page + 1));
                }
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.getListError`, page.toString(), localize(`${this.pluginName}.publicGists`), <string>error));
            }
        });
    }




    /**
     * 编辑一个代码片段
     */
    public async edit() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${this.pluginName}.gistNotOpen`));
            return;
        }
        const docPath = path.resolve(edit.document.uri.fsPath);
        const docDir = path.dirname(path.dirname(docPath));
        const savePath = this.getSavePath("user");

        // 判断当前文档的路径是否为代码片段存储目录
        if (savePath.toLocaleLowerCase() !== docDir.toLocaleLowerCase()) {
            window.showErrorMessage(localize(`${this.pluginName}.documentIsNotOperate`, savePath, docDir));
            return;
        }
        try {
            const fileName = path.basename(docPath);
            const gist = await this.api.getSingle(path.basename(path.dirname(docPath)));
            const description = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.gistEditPlaceHolder`, gist.description) }) || gist.description;
            gist.files[fileName].content = edit.document.getText();
            gist.description = description;
            await this.api.edit(gist);
            window.setStatusBarMessage(localize(`${this.pluginName}.gistEditSuccess`, description, fileName),3000);
            this.getNew();
        } catch (error) {
            window.showErrorMessage(localize(`${this.pluginName}.gistEditError`, <string>error));
        }
    }

    /**
     * 新建代码片段
     * @param description 代码片段描述
     * @param fileName 文件名
     * @param content 文件内容
     * @param isPublic 是否公开
     */
    private async create(description: string, fileName: string, content: string, isPublic: string) {
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCreateProgress`, description), async () => {
            try {
                if (content === "") {
                    window.showErrorMessage(localize(`${this.pluginName}.gistCreateError`, description, localize(`${this.pluginName}.contentEmptyError`)));
                    return;
                }
                await this.api.create({
                    description,
                    public: isPublic === "" ? false : isPublic === "false" ? false : true,
                    files: {
                        [fileName]: { content },
                    },
                });
                window.setStatusBarMessage(localize(`${this.pluginName}.gistCreateSuccess`, description),3000);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCreateError`, description, <string>error));
            }
        });
    }

    /**
     * 将文件添加到已有的代码片段
     */
    private async add(fileName: string, content: string) {
        this.selectItem([], localize(`${this.pluginName}.loading`));
        const gistList = await this.gistTreeDataProvider.itemData;
        const itemList: QuickPickItemAction[] = [];
        for (const gist of gistList) {
            gist.files = gist.files || [];
            itemList.push({
                description: localize(`${this.pluginName}.fileCount`, Object.keys(gist.files).length.toString()),
                label: gist.description,
                action: async (item: QuickPickItemAction) => {
                    this.executeCommandWithProgress(localize(`${this.pluginName}.gistAddProgress`, fileName, gist.description), async () => {
                        try {
                            if (gist.files[fileName]) {
                                const result = await window.showWarningMessage(localize(`${this.pluginName}.gistAddConfirm`, fileName, gist.description), localize(`${this.pluginName}.confirm`), localize(`${this.pluginName}.cancel`));
                                if (result !== localize(`${this.pluginName}.confirm`)) {
                                    return;
                                }
                            }
                            gist.files = {
                                [fileName]: { content },
                            };
                            await this.api.edit(gist);
                            window.setStatusBarMessage(localize(`${this.pluginName}.gistAddSuccess`, fileName, gist.description),3000);
                            this.getNew();
                        } catch (error) {
                            window.showErrorMessage(localize(`${this.pluginName}.gistAddError`, fileName, gist.description, <string>error));
                        }
                        this.quickPick.hide();
                    });
                },
            });
        }
        this.selectItem(itemList, localize(`${this.pluginName}.select`, localize(`${this.pluginName}.gists`)));
    }

    /**获取代码片段的提交记录
     * @param {string} id 代码片段id
     */
    public async getCommits() {
        if (this.tokenType === "gitee" || this.currId === '') {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCommitsProgress`), async () => {
            try {
                let commitList = await this.api.getCommits(this.currId);
                this.gistCommits?.setData(commitList.map(item => { return new GistCommitTreeItem(item); }));
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCommitsError`, <string>error));
            }
        });
    }

    /**获取代码片段的评论列表
     * @param {string} id 代码片段id
     */
    public async getComments(page: number = 1) {
        if (this.currId === '') {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCommentsProgress`), async () => {
            try {
                let commentList = await this.api.getComments(this.currId, page);
                this.gistComments?.setData(commentList.map(item => { return new GistCommentTreeItem(item); }));
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCommentsError`,<string>error));
            }
        });
    }

    /**
     * 添加代码片段的评论
     * @param {string} id 代码片段ID
     * @return {*}
     */
    public async addComment() {
        if (!this.checkCurrId()) { return; }
        const body = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.gistCommentCreatePlaceHolder`) });
        if (body === undefined) { return; }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCommentCreateProgress`), async () => {
            try {
                await this.api.addComment(this.currId, body);
                window.setStatusBarMessage(localize(`${this.pluginName}.gistCommentCreateSuccess`,body),3000);
                this.getComments();
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCommentCreateError`,body,<string>error));
            }
        });
    }

    /**
     * 编辑代码片段的评论
     * @param {string} id 代码片段ID
     * @return {*}
     */
    public async editComment(commentId: string, body: string) {
        if (!this.checkCurrId()) { return; }
        const bodyNew = await window.showInputBox({ placeHolder: localize(`${this.pluginName}.gistCommentEditPlaceHolder`,body), value: body });
        if (bodyNew === undefined) { return; }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCommentEditProgress`), async () => {
            try {
                await this.api.editComment(this.currId, commentId, bodyNew);
                this.getComments();
                window.setStatusBarMessage(localize(`${this.pluginName}.gistCommentEditSuccess`,body),3000);
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCommentEditError`,body,<string>error));
            }
        });
    }

    public async deleteComment(commentId: string,body:string) {
        const result = await window.showWarningMessage(localize(`${this.pluginName}.gistCommentDeleteConfirm`, body), localize(`${this.pluginName}.confirm`), localize(`${this.pluginName}.cancel`));
        if (result !== localize(`${this.pluginName}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistCommentDeleteProgress`,body), async () => {

            try {
                await this.api.deleteComment(this.currId, commentId);
                this.getComments();
                window.setStatusBarMessage(localize(`${this.pluginName}.gistCommentDeleteSuccess`,body),3000);
            } catch (error) {
                window.showErrorMessage(localize(`${this.pluginName}.gistCommentDeleteError`,body,<string>error));
            }
        });
    }

    /**
     * 检查是否选中代码片段
     */
    private checkCurrId(): boolean {
        if (this.currId === '') {
            window.setStatusBarMessage(localize(`${this.pluginName}.gistNoSelected`),3000);
            return false;
        }
        return true;
    }

    /**
     * 
     * @param items 列表项
     * @param placeholder 输入框提示
     */
    private selectItem(items: QuickPickItemAction[], placeholder: string) {
        this.quickPick.busy = false;
        this.quickPick.value = '';
        this.quickPick.items = items;
        this.quickPick.placeholder = placeholder;
        this.quickPick.show();
    }

    /**
     * 获取代码片段临时存储目录
     */
    public getSavePath(isPublic: string | boolean | undefined) {
        let ispublicTemp = isPublic === 'true' || isPublic === true;
        const savePath: string = workspace.getConfiguration("gist").get("savePath") || `${os.homedir()}/.ldgGist`;
        return path.resolve(path.join(savePath, this.tokenType, ispublicTemp ? "public" : "prive"));
    }

    /**
     * 打开新的文件编辑窗口
     * @param gist 代码片段
     * @param fileName 文件名
     * @param type 代码片段类型: true(个人)/false(代码片段广场)
     */
    public async createTextEditor(args: any[]) {
        let gist = args[0] as Gist;
        let fileName = args[1] as string;
        const filePath = `${this.getSavePath(gist.public)}/${gist.id}/${fileName}`;
        //避免同一个文件被多次点击
        if (this.lastFile === filePath) { return; }
        this.lastFile = filePath;
        this.executeCommandWithProgress(localize(`${this.pluginName}.gistContentProgress`), async () => {
            let agreement: string;
            try {
                // 检测文件是否已存在
                fs.accessSync(filePath);
                agreement = "file:";
            } catch (error) {
                agreement = "untitled:";
            }
            const temp = `${agreement}${this.getSavePath(gist.public)}/${gist.id}/${fileName}`;
            const uri = Uri.parse(temp);
            const content = await this.api.getContent(gist.files[fileName]);

            let filedir = path.dirname(uri.fsPath);
            this.mkdir(filedir);
            await fs.writeFile(uri.fsPath, content, (r) => {
                if (r !== null) {
                    window.showErrorMessage(localize(`${this.pluginName}.fileWriteError`,r.message));
                } else {
                    window.showTextDocument(Uri.file(uri.fsPath), { preview: true, });
                }
            });

            // const doc = await workspace.openTextDocument(uri);
            // const textEditor = await window.showTextDocument(doc, { preview: true });
            // textEditor.edit((editBuilder) => {
            //     //避免点击次数过多，重复加载文件，先清空内容
            //     editBuilder.delete(new Range(new Position(0, 0), new Position(doc.lineCount, 0)));
            //     editBuilder.insert(new Position(0, 0), content);
            // });
        });

    }
    private async executeCommandWithProgress(message: string, callback: any): Promise<void> {
        await window.withProgress({ location: ProgressLocation.Notification }, async (p: Progress<{}>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: any) => void): Promise<void> => {
                p.report({ message });
                try {
                    await callback();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
    /** 创建文件夹
   * @param {*} dirname 要创建的文件夹名
   */
    private mkdir(dirname: string) {
        if (fs.existsSync(dirname)) {
            return true;
        } else {
            if (this.mkdir(path.dirname(dirname))) {
                fs.mkdirSync(dirname);
                return true;
            }
        }
    }
}