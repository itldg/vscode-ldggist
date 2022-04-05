import {
    workspace,
} from "vscode";

import * as request from "request";
import { GitBase, Gist, GistFile, GistCommit, GistComment } from "./gitBase";


export default class Gitee implements GitBase {
    urlBase: string;
    public token: string = "";
    constructor() {
        this.urlBase = "https://gitee.com/api/v5/";
    }




    public create(gist: Gist): Promise<void> {
        return new Promise((resolve, reject) => {
            request.post(`${this.urlBase}gists`, {
                body: {
                    files: gist.files,
                    public: gist.public,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    access_token: this.token,
                    description: gist.description,
                },
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 201) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }

    public delete(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            request.delete(`${this.urlBase}gists/${id}`, {
                body: {
                    id,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    access_token: this.token,
                },
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 204) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }

    public deleteFile(id: string, fileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            request.patch(`${this.urlBase}gists/${id}`, {
                body: {
                    id: id,
                    files: {
                        [fileName]: null
                    },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    access_token: this.token,
                },
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }

    public getList(limit: number, page: number,since: string = ""): Promise<Gist[]> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}gists?access_token=${this.token}&page=${page}&since=${since}&per_page${limit}`, {
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    const list: Gist[] = res.body.map((item: any): Gist => {
                        return item as Gist;
                    });
                    resolve(list);
                }
            });
        });
    }

    public edit(gist: Gist): Promise<void> {
        return new Promise((resolve, reject) => {
            request.patch(`${this.urlBase}gists/${gist.id}`, {
                body: {
                    files: gist.files,
                    description: gist.description,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    access_token: this.token,
                },
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }

    public getPublicList(limit: number, page: number): Promise<Gist[]> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}gists/public?access_token=${this.token}&page=${page}&per_page${limit}`, {
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    const list: Gist[] = res.body.map((item: any): Gist => {
                        return {
                            id: item.id,
                            files: item.files,
                            public: item.public,
                            owner: item.owner.name,
                            description: item.description,
                        };
                    });
                    resolve(list);
                }
            });
        });
    }

    public getSingle(id: string): Promise<Gist> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}gists/${id}?access_token=${this.token}`, {
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve(res.body as Gist);
                }
            });
        });
    }

    public getContent(gistFile: GistFile): Promise<string> {
        return Promise.resolve(gistFile.content);
    }
    public getCommits(id: string): Promise<GistCommit[]> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}gists/${id}/commits?access_token=${this.token}`, {
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve(res.body.map((item: any): GistCommit => {
                        return <GistCommit>item;
                    }));
                }
            });
        });
    }
    getComments(id: string, page: number): Promise<GistComment[]> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}/gists/${id}/comments?access_token=${this.token}&page=${page}`, {
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve(res.body.map((item: any): GistCommit => {
                        return <GistCommit>item;
                    }));
                }
            });
        });
    }
    addComment(id: string, body: string): Promise<void> {
        return new Promise((resolve, reject) => {
            request.post(`${this.urlBase}/gists/${id}/comments`, {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                body: { body, access_token: this.token, },
                json: true,
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 201) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }
    editComment(id: string, commentId: string, body: string): Promise<void> {
        return new Promise((resolve, reject) => {
            request.patch(`${this.urlBase}/gists/${id}/comments/${commentId}?access_token=${this.token}`, {
                body: { body },
                json: true
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }
    deleteComment(id: string, commentId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            request.delete(`${this.urlBase}/gists/${id}/comments/${commentId}?access_token=${this.token}`, {
                json: true
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 204) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve();
                }
            });
        });
    }

}