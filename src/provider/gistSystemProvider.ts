import * as path from 'path';
import * as vscode from 'vscode';
import GistApi from '../api/gistServer';
import { Gist, GistFile } from '../api/gitBase';
import { FS_SCHEME } from '../constants';

export class File implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    data?: Uint8Array;

    constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
    }
}

export class Directory implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    entries: Map<string, File | Directory>;

    constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
    }
}

export type Entry = File | Directory;

export class GistFs implements vscode.FileSystemProvider {
    root: Directory = new Directory('');
    gistApi: GistApi = {} as GistApi;
    constructor(gistApi: GistApi) {
        this.gistApi = gistApi;
    }

    async openGist(gistId: string, filename: string = ""): Promise<void> {
        const uri = vscode.Uri.parse(`${FS_SCHEME}://${gistId}/${encodeURIComponent(filename)}`);
        try {

            const fileStat =await this.stat(uri);
            const gist =await this.gistApi.getGistForId(uri.authority);
            if ((gist.updated_at ? Date.parse(gist.updated_at) : Date.now()) > fileStat.mtime) {
                //gist文件已经被修改过了
                this.delete(uri);
            }
        } catch (e) {

        }
        vscode.commands.executeCommand("vscode.open", uri, {
            preview: true,
            viewColumn: vscode.ViewColumn.Active
        });
    }
    async getFileFromUri(uri: vscode.Uri): Promise<GistFile> {
        const gist =await this.gistApi.getGistForId(uri.authority);
        return gist.files[uri.path.substring(1)]!;
    }

    // --- manage file metadata

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        try {
            //如果有文件缓存直接返回结果
            return this._lookup(uri, false);
        } catch (e) {
            //没有缓存使用GitFile的信息
            const gist =await this.gistApi.getGistForId(uri.authority);
            const gistFile = await this.getFileFromUri(uri);
            if (!gistFile) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            return {
                type: vscode.FileType.File,
                ctime: 0,
                mtime: gist.updated_at ? Date.parse(gist.updated_at) : Date.now(),
                size: gistFile.size!
            };
        }
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const gist =await this.gistApi.getGistForId(uri.authority);
        const result: [string, vscode.FileType][] = [];
        let files = Object.keys(gist.files);
        for (let i = 0; i < files.length; i++) {
            result.push([files[i], vscode.FileType.File]);
        }
        return result;
    }

    // --- manage file contents

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        //console.log('readFile', uri.path);
        try {
            const data = this._lookupAsFile(uri, false).data;
            if (data) {
                return data;
            }
        } catch (e: any) {
            if (e.code === 'FileNotFound') {
                const gistFile =await this.getFileFromUri(uri);
                const content = await this.gistApi.api.getContent(gistFile);
                if (content) {
                    const data = Buffer.from(content);
                    this.writeFile(uri, data, { create: true, overwrite: true });
                    return this.readFile(uri);
                    //return data;
                }
            } else {
                throw e;
            }
        }
        throw vscode.FileSystemError.FileNotFound();
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
        //console.log('writeFile', uri.path);
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry) {
            entry = new File(basename);
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    // --- manage files/folders

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        //console.log('rename', oldUri.path, newUri.path);
        if (!options.overwrite && this._lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        const entry = this._lookup(oldUri, false);
        const oldParent = this._lookupParentDirectory(oldUri);

        const newParent = this._lookupParentDirectory(newUri);
        const newName = path.posix.basename(newUri.path);

        oldParent.entries.delete(entry.name);
        entry.name = newName;
        newParent.entries.set(newName, entry);

        this._fireSoon(
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        );
    }

    delete(uri: vscode.Uri): void {
        //console.log('delete', uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupAsDirectory(dirname, false);
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    createDirectory(uri: vscode.Uri): void {
        //console.log('createDirectory', uri.path);
        const basename = path.posix.basename(uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const parent = this._lookupAsDirectory(dirname, false);

        const entry = new Directory(basename);
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- lookup

    private _lookup(uri: vscode.Uri, silent: false): Entry;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
        const parts = uri.path.split('/');
        let entry: Entry = this.root;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof Directory) {
                child = entry.entries.get(part);
            }
            if (!child) {
                if (!silent) {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else {
                    return undefined;
                }
            }
            entry = child;
        }
        return entry;
    }

    private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
        const entry = this._lookup(uri, silent);
        if (entry instanceof Directory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
        const entry = this._lookup(uri, silent);
        if (entry instanceof File) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private _lookupParentDirectory(uri: vscode.Uri): Directory {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_resource: vscode.Uri): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }
}
