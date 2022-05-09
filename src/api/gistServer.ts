import {
    window,
    QuickPick,
    QuickPickItem,
    Progress,
    ProgressLocation,
    FileSystemError
} from "vscode";
import { EXTENSION_NAME, FS_SCHEME } from "../constants";

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
    private since: string = '';
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

    /** 通过id获取gist */
    public async getGistForId(id: string): Promise<Gist> {
        let gist = this.gistTreeDataProvider.getGistForId(id);
        if (!gist) {
            gist = await this.api.getSingle(id);
        }
        return gist;
    }

    /**
     * 使用选中内容创建一个代码片段
     */
    public async createBySelect() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.noSelected`));
            return;
        }
        const description = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistDescription`) }) || "";
        const fileName = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.fileName`) }) || "";
        const ispublic = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.isPublic`) }) || "";
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
                window.showErrorMessage(localize(`${EXTENSION_NAME}.fileContentEmptyError`));
                return;
            }
            const description = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistDescription`) }) || "";
            const ispublic = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.isPublic`) }) || "";
            await this.create(description, path.basename(filePath), content, ispublic);
        } catch (error) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.upFileError`, filePath, <string>error));
        }
    }

    /**
     * 将选中内容添加到已有的代码片段
     */
    public async addBySelect() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.noSelected`));
            return;
        }
        const fileName = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.fileName`) }) || "";
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
                window.showErrorMessage(localize(`${EXTENSION_NAME}.fileContentEmptyError`));
                return;
            }
            await this.add(path.basename(filePath), content);
        } catch (error) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.upFileError`, filePath, <string>error));
        }
    }

    /**
     * 修改代码片段的描述
     */
    public async changeDescription(element: GistTreeItem) {
        const description = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistEditPlaceHolder`, element.gist!.description), value: element.gist!.description });
        if (!description || description === element.gist!.description) {
            //如果为空或者未改变,不保存
            return;
        }
        try {
            const gist: Gist = { description, id: element.gist!.id } as Gist;
            await this.api.edit(gist);
            window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistchangeDescriptionSuccess`, description), 3000);
            this.getNew();
        } catch (error) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.gistEditError`, <string>error));
        }
    }

    /**
     * 删除一个代码片段
     */
    public async delete(element: GistTreeItem) {
        const result = await window.showWarningMessage(localize(`${EXTENSION_NAME}.gistDeleteConfirm`, <string>element.label), localize(`${EXTENSION_NAME}.confirm`), localize(`${EXTENSION_NAME}.cancel`));
        if (result !== localize(`${EXTENSION_NAME}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistDeleteProgress`, <string>element.label), async () => {
            try {
                await this.api.delete(element.id || "");
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistDeleteSuccess`, <string>element.label), 3000);
                this.gistTreeDataProvider.removeGist(<string>element.id);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistDeleteError`, <string>element.label, <string>error));
            }
        });

    }

    /**
    * 代码片段中的文件重命名
    */
    public async renameFile(element: GistFileTreeItem) {
        const fileName = <string>element.label;
        const newFileName = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistFileRenamePlaceHolder`, fileName)});
        if (!newFileName || newFileName === fileName) {
            //如果为空或者未改变,不保存
            return;
        }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistFileRenameProgress`, <string>element.gist.description, <string>fileName), async () => {
            try {
                if(element.gist.files[newFileName]){ 
                    throw FileSystemError.FileExists(newFileName);
                }
                let gist =await this.getGistForId(element.gist.id!);
                let newgist:Gist={id:gist.id,description:gist.description,files:{}} as Gist;
                newgist.files[newFileName]={'content':await this.api.getContent(gist.files[fileName]!)} as GistFile;
                newgist.files[fileName]=null;
                await this.api.edit(newgist);
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistFileRenameSuccess`, <string>element.gist.description, <string>fileName), 3000);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistFileRenameError`, <string>element.gist.description, <string>fileName, <string>error));
            }
        });
    }

    /**
     * 删除代码片段中的一个文件
     */
    public async deleteFile(element: GistFileTreeItem) {
        const fileName = <string>element.label;
        const result = await window.showWarningMessage(localize(`${EXTENSION_NAME}.gistFileDeleteConfirm`, <string>element.gist.description, <string>fileName), localize(`${EXTENSION_NAME}.confirm`), localize(`${EXTENSION_NAME}.cancel`));
        if (result !== localize(`${EXTENSION_NAME}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistFileDeleteProgress`, <string>element.gist.description, <string>fileName), async () => {
            try {
                await this.api.deleteFile(element.gist.id || "", fileName);
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistFileDeleteSuccess`, <string>element.gist.description, <string>fileName), 3000);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistFileDeleteError`, <string>element.gist.description, <string>fileName, <string>error));
            }
        });
    }
    /**
     * 获取最近更新的代码片段
     */
    public async getNew() {
        this.getList(1, this.since);
    }
    /**
     * 获取个人的代码片段
     */
    public async getList(page: number = 1, since: string = "") {
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.getListProgress`, page.toString(), localize(`${EXTENSION_NAME}.gists`)), async () => {
            try {
                let gistList = await this.api.getList(this.limit, page, since);
                if (gistList.length > 0) {
                    gistList.map(gist => {
                        if (<string>gist.updated_at > this.since) {
                            this.since = <string>gist.updated_at;
                        }
                    });
                }
                if (page === 1) {
                    this.currId = '';
                }
                if (since !== '') {
                    this.gistTreeDataProvider.insertData(gistList, false);
                } else {
                    if (page === 1) {
                        this.gistTreeDataProvider.setData(gistList, false);
                    } else {
                        this.gistTreeDataProvider.appendData(gistList, false);
                    }
                }
                if (gistList.length === this.limit) {
                    this.getList((page + 1), since);
                }

            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.getListError`, page.toString(), localize(`${EXTENSION_NAME}.gists`), <string>error));
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
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.getListProgress`, page.toString(), localize(`${EXTENSION_NAME}.publicGists`)), async () => {
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
                window.showErrorMessage(localize(`${EXTENSION_NAME}.getListError`, page.toString(), localize(`${EXTENSION_NAME}.publicGists`), <string>error));
            }
        });
    }

    /**
     * 编辑一个代码片段
     */
    public async edit() {
        const edit = window.activeTextEditor;
        if (!edit) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.gistNotOpen`));
            return;
        }

        if (edit.document.uri.scheme !== FS_SCHEME) {
            return;
        }
        const docPath = path.resolve(edit.document.uri.fsPath);
        try {
            const fileName = path.basename(docPath);
            const gist = await this.api.getSingle(edit.document.uri.authority);
            gist.files[fileName]!.content = edit.document.getText();
            await this.api.edit(gist);
            window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistEditSuccess`, gist.description, fileName), 3000);
            this.getNew();
        } catch (error) {
            window.showErrorMessage(localize(`${EXTENSION_NAME}.gistEditError`, <string>error));
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
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCreateProgress`, description), async () => {
            try {
                if (content === "") {
                    window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCreateError`, description, localize(`${EXTENSION_NAME}.contentEmptyError`)));
                    return;
                }
                await this.api.create({
                    description,
                    public: isPublic === "" ? false : isPublic === "false" ? false : true,
                    files: {
                        [fileName]: { content },
                    },
                });
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistCreateSuccess`, description), 3000);
                this.getNew();
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCreateError`, description, <string>error));
            }
        });
    }

    /**
     * 将文件添加到已有的代码片段
     */
    private async add(fileName: string, content: string) {
        this.selectItem([], localize(`${EXTENSION_NAME}.loading`));
        const gistList = await this.gistTreeDataProvider.itemData;
        const itemList: QuickPickItemAction[] = [];
        for (const gist of gistList) {
            gist.files = gist.files || [];
            itemList.push({
                description: localize(`${EXTENSION_NAME}.fileCount`, Object.keys(gist.files).length.toString()),
                label: gist.description,
                action: async (item: QuickPickItemAction) => {
                    this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistAddProgress`, fileName, gist.description), async () => {
                        try {
                            if (gist.files[fileName]) {
                                const result = await window.showWarningMessage(localize(`${EXTENSION_NAME}.gistAddConfirm`, fileName, gist.description), localize(`${EXTENSION_NAME}.confirm`), localize(`${EXTENSION_NAME}.cancel`));
                                if (result !== localize(`${EXTENSION_NAME}.confirm`)) {
                                    return;
                                }
                            }
                            gist.files = {
                                [fileName]: { content },
                            };
                            await this.api.edit(gist);
                            window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistAddSuccess`, fileName, gist.description), 3000);
                            this.getNew();
                        } catch (error) {
                            window.showErrorMessage(localize(`${EXTENSION_NAME}.gistAddError`, fileName, gist.description, <string>error));
                        }
                        this.quickPick.hide();
                    });
                },
            });
        }
        this.selectItem(itemList, localize(`${EXTENSION_NAME}.select`, localize(`${EXTENSION_NAME}.gists`)));
    }

    /**获取代码片段的提交记录
     * @param {string} id 代码片段id
     */
    public async getCommits() {
        if (this.tokenType === "gitee" || this.currId === '') {
            return;
        }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCommitsProgress`), async () => {
            try {
                let commitList = await this.api.getCommits(this.currId);
                this.gistCommits?.setData(commitList.map(item => { return new GistCommitTreeItem(item); }));
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCommitsError`, <string>error));
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
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCommentsProgress`), async () => {
            try {
                let commentList = await this.api.getComments(this.currId, page);
                this.gistComments?.setData(commentList.map(item => { return new GistCommentTreeItem(item); }));
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCommentsError`, <string>error));
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
        const body = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistCommentCreatePlaceHolder`) });
        if (body === undefined) { return; }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCommentCreateProgress`), async () => {
            try {
                await this.api.addComment(this.currId, body);
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistCommentCreateSuccess`, body), 3000);
                this.getComments();
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCommentCreateError`, body, <string>error));
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
        const bodyNew = await window.showInputBox({ placeHolder: localize(`${EXTENSION_NAME}.gistCommentEditPlaceHolder`, body), value: body });
        if (bodyNew === undefined) { return; }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCommentEditProgress`), async () => {
            try {
                await this.api.editComment(this.currId, commentId, bodyNew);
                this.getComments();
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistCommentEditSuccess`, body), 3000);
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCommentEditError`, body, <string>error));
            }
        });
    }

    public async deleteComment(commentId: string, body: string) {
        const result = await window.showWarningMessage(localize(`${EXTENSION_NAME}.gistCommentDeleteConfirm`, body), localize(`${EXTENSION_NAME}.confirm`), localize(`${EXTENSION_NAME}.cancel`));
        if (result !== localize(`${EXTENSION_NAME}.confirm`)) {
            return;
        }
        this.executeCommandWithProgress(localize(`${EXTENSION_NAME}.gistCommentDeleteProgress`, body), async () => {

            try {
                await this.api.deleteComment(this.currId, commentId);
                this.getComments();
                window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistCommentDeleteSuccess`, body), 3000);
            } catch (error) {
                window.showErrorMessage(localize(`${EXTENSION_NAME}.gistCommentDeleteError`, body, <string>error));
            }
        });
    }

    /**
     * 检查是否选中代码片段
     */
    private checkCurrId(): boolean {
        if (this.currId === '') {
            window.setStatusBarMessage(localize(`${EXTENSION_NAME}.gistNoSelected`), 3000);
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