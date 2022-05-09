import * as vscode from 'vscode';
import { Event, EventEmitter } from 'vscode';
import { Gist } from '../api/gitBase';
import { GistFileTreeItem, GistTreeItem } from './gistTreeItem';
export interface AnyTreeDataProvider {
    setData (newData: Array<any>) :void
}
export class GistTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem>
{
    itemData: Array<Gist> = [];
    itemTree:Array<vscode.TreeItem> = [];
    getGistForId(gistId: string): Gist {
        return this.itemData.filter(item => item.id === gistId)[0];
    }
    removeGist(gistId: string) {
        this.itemData=this.itemData.filter(item => item.id !== gistId);
    }
    private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();

    readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    insertData(items:Array<Gist>,isPublic:boolean)
    {
        if(items.length>0)
        {
            this.itemData=this.itemData.filter(item => {
                let idList= items.map(v => v.id);
                return !idList.includes(item.id);
            });
            this.itemData=[...items,...this.itemData];
        }
        this.itemTree=this.itemData.map(item=>new GistTreeItem(item,isPublic));
        this._onDidChangeTreeData.fire(undefined);
    }
    setData(items:Array<Gist>,isPublic:boolean) {
        this.itemData=items;
        this.itemTree=items.map(item=>new GistTreeItem(item,isPublic));
        this._onDidChangeTreeData.fire(undefined);
    }
    appendData(items:Array<Gist>,isPublic:boolean)
    {
        if(items.length>0)
        {
            this.itemData=[...this.itemData,...items];
        }
        this.itemTree=this.itemData.map(item=>new GistTreeItem(item,isPublic));
        this._onDidChangeTreeData.fire(undefined);
    }

    setTip(titp:string) {
        this.itemTree=[{ label: titp }];
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem) {
        return element;
    }

    getChildren(element: vscode.TreeItem) {
        if (element === undefined) {
            return this.itemTree;
        }
        else if (element.collapsibleState) {
            let gist=this.getGistForId(<string>element.id);
            let giteeFIles = gist.files;
            let files = Object.keys(giteeFIles);
            let children: Array<vscode.TreeItem> = [];
            for (let i = 0; i < files.length; i++) {
                children.push(new GistFileTreeItem(giteeFIles[files[i]]!, files[i], gist));
            }
            return children;
        } else {
            return null;
        }
    }

    getParent(element: GistTreeItem) {
        return null;
    }
}