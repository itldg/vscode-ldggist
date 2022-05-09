export interface Gist {
    url?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    forks_url?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    commits_url?: string;
    id?: string;
    //Gitee 无此字段
    // eslint-disable-next-line @typescript-eslint/naming-convention
    node_id?: string;
    description: string;
    public?: boolean;
    owner?: UserInfo;
    user?: UserInfo;
    files: GistFiles;
    //是否截断 GitHub是Bool Gitee是字符串
    truncated?: boolean;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    html_url?: string;
    comments?: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    comments_url?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    git_pull_url?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    git_push_url?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    created_at?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    updated_at?: string;
}

export interface GistFiles {
    [fileName: string]: GistFile|null;
}

export interface GistFile {
    size?: number;
    //Gitee基本固定返回 "text/plain; charset=utf-8"
    type?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    raw_url?: string;
    truncated?: boolean;
    content: string;
    //Gitee 无此字段
    language?: string;
}

interface UserInfo {
    login: string;
    id: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    node_id: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    avatar_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gravatar_id: string;
    url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    html_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    followers_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    following_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gists_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    starred_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    subscriptions_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    organizations_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    repos_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    events_url: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    received_events_url: string;
    type: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    site_admin: boolean;
}


export interface ChangeStatus {
    deletions: number;
    additions: number;
    total: number;
}

export interface GistCommit {
    url: string;
    version: string;
    user: UserInfo;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    change_status: ChangeStatus;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    committed_at: string;
}


export interface ChangeStatus {
    deletions: number;
    additions: number;
    total: number;
}



export interface GistComment {
    id: number;
    body: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    updated_at: string;
}

export interface GitBase {
    //接口地址前缀
    urlBase: string;
    //私人令牌
    token: string;
    /**
     * 新建代码片段
     * @param gist 代码片段
     */
    create(gist: Gist): Promise<void>;

    /**
     * 获取当前用户的代码片段
     * @param limit 每页数量
     * @param page 页码(从1开始)
     */
    getList(limit: number, page: number,since: string): Promise<Gist[]>;

    /**
     * 获取公开的代码片段
     * @param limit 每页数量
     * @param page 页码(从1开始)
     */
    getPublicList(limit: number, page: number): Promise<Gist[]>;

    /**
     * 修改代码片段
     * @param gist 代码片段
     */
    edit(gist: Gist): Promise<void>;

    /**
     * 删除代码片段
     * @param id 代码片段id
     */
    delete(id: string): Promise<void>;

    /**
     * 
     * @param id 代码片段id
     * @param fileName 要删除的文件
     */
    deleteFile(id: string, fileName: string): Promise<void>;

    /**
     * 获取一条代码片段
     * @param id 代码片段id
     */
    getSingle(id: string): Promise<Gist>;

    /**
     * 获取代码片段的内容
     * @param gistFile 代码片段
     */
    getContent(gistFile: GistFile): Promise<string>;

    /**
     * 获取代码片段的提交记录
     * @param id 代码片段id
     */
    getCommits(id: string): Promise<GistCommit[]>;

    /**获取代码片段的评论
     * @param {string} gistId 代码片段的ID
     * @param {number} page 当前的页码
     */
    getComments(id: string, page: number): Promise<GistComment[]>;

    /** 增加代码片段的评论
     * @param {string} gistId 代码片段ID
     * @param {string} body 评论的内容
     */
    addComment(id: string, body: string): Promise<void>;

    /**更新代码片段的评论
     * @param {string} gistId 代码片段的ID
     * @param {string} commentId 	评论的ID
     * @param {string} body 评论内容
     */
    editComment(id: string, commentId: string, body: string): Promise<void>;

    /**获取代码片段的评论
     * @param {string} id 代码片段的ID
     * @param {string} commentId 评论的ID
     */
    deleteComment(id: string, commentId: string): Promise<void>;
}