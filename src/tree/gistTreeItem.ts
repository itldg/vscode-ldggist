import { Command, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { Gist, GistFile, GistComment, GistCommit } from "../api/gitBase";
import { Util } from "../util";
import localize from "../localize";
import {EXTENSION_NAME} from "../constants";
export class GistTreeItem extends TreeItem {
    public:boolean;
    gist: Gist | undefined;
    constructor(info: Gist,isPublic : boolean) {
        super(info.description,(info.files?Object.keys(info.files).length:0)?TreeItemCollapsibleState.Collapsed: TreeItemCollapsibleState.None);
        this.label = info.description;
        this.id = info.id;
        if(isPublic)
        {
            this.tooltip = info.description;
            this.description =localize(`${EXTENSION_NAME}.owner`)+ `: ${info.owner?.login}，`+localize(`${EXTENSION_NAME}.fileCount`,Object.keys(info.files).length.toString());

        }else{
            this.tooltip = ('['+localize(`${EXTENSION_NAME}.${info.public ? 'public' : 'private'}`)+']') + info.description;
            this.iconPath = new ThemeIcon(info.public ? 'eye' : 'lock');
            if (info.html_url) {
                this.resourceUri = Uri.parse(info.html_url);
            }
            if (info.updated_at) {
                this.description = Util.timeAgo(new Date(Date.parse(info.updated_at)).getTime());
            }
        }
        this.public=isPublic;
        this.gist=info;
        if(!isPublic)
        {
            this.command = {
                title: String(info.description),
                command: 'ldgGist.selectedGist',
                arguments: [
                    <string>info.id
                ],
            };
        }
    } 
    contextValue="gist";
}

export class GistFileTreeItem extends TreeItem {
    gist: Gist;
    constructor(info: GistFile, filename:string, gist: Gist) {
        super(filename, TreeItemCollapsibleState.None);
        this.description = info.language ? info.language :Util.byteConvert( <number>info.size);
        this.resourceUri=Uri.parse(filename);
        this.gist=gist;
        this.command={
            title: String(filename),
            command:'ldgGist.openCode',
            arguments:[
                gist,
                filename
            ]
        };
    }
    iconPath = ThemeIcon.File;
    contextValue = "gistFile";
}

export class GistCommitTreeItem extends TreeItem {
    constructor(info: GistCommit) {
        super(info.version, TreeItemCollapsibleState.None);
        this.label = info.change_status.total + ' '+localize(`ldgGist.changed`);  
        this.description = Util.timeAgo(new Date(Date.parse(info.committed_at)).getTime());
        this.tooltip = info.change_status.additions + ' '+localize('ldgGist.additions')+'\n' + info.change_status.deletions + ' '+localize('ldgGist.deletions');
        this.iconPath = new ThemeIcon('git-commit');
    }
    contextValue = "gistCommit";
}

export class GistCommentTreeItem extends TreeItem {
    constructor(info: GistComment) {
        super('GiteeComment', TreeItemCollapsibleState.None);
        this.label = info.body;
        this.id = String(info.id);
        this.description = Util.timeAgo(new Date(Date.parse(info.created_at)).getTime());
        this.iconPath = new ThemeIcon('comment');
    }
    contextValue = "gistComment";
}
