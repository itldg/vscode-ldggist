import {
    workspace,
} from "vscode";

import * as request from "request";
import { GitBase, Gist, GistFile, GistComment, GistCommit } from "./gitBase";


export default class Github implements GitBase {
    urlBase: string;
    public token: string = "";
    constructor() {
        this.urlBase = "https://api.github.com";
    }


    private getHeader(): any {
        return {
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "User-Agent": "ldgGist",
                "authorization": `token ${this.token}`
            },
            json: true,
        };
    }

    public create(gist: Gist): Promise<void> {
        return new Promise((resolve, reject) => {
            request.post(`${this.urlBase}/gists`, {
                body: {
                    files: gist.files,
                    public: gist.public,
                    description: gist.description,
                },
                ... this.getHeader()
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
            request.delete(`${this.urlBase}/gists/${id}`, {
                body: {
                    id,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    access_token: this.token,
                },
                ... this.getHeader()
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
            request.patch(`${this.urlBase}/gists/${id}`, {
                body: {
                    files: {
                        [fileName]: null,
                    },
                },
                ... this.getHeader()
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
            request.get(`${this.urlBase}/gists?page=${page}&since=${since}&per_page=${limit}`, {
                ... this.getHeader()
            }, (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve(res.body.map((item: any): Gist => {
                        return <Gist>item;
                    }));
                }
            });
        });
    }

    public edit(gist: Gist): Promise<void> {
        return new Promise((resolve, reject) => {
            request.patch(`${this.urlBase}/gists/${gist.id}`, {
                body: {
                    files: gist.files,
                    description: gist.description,
                },
                ... this.getHeader()
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
            request.get(`${this.urlBase}/gists/public?page=${page}&per_page=${limit}`, {
                ... this.getHeader()
            }, async (err, res) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(typeof res.body === "string" ? res.body : JSON.stringify(res.body));
                } else {
                    resolve(res.body.map((item: any): Gist => {
                        return item as Gist;
                    }));
                }
            });
        });
    }

    public getSingle(id: string): Promise<Gist> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}/gists/${id}`, {
                ... this.getHeader()
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
        return new Promise((resovle, reject) => {
            request.get(gistFile.raw_url || "", this.getHeader(),(err: any, res: request.Response) => {
                if (err) {
                    reject(err.message);
                } else if (res.statusCode !== 200) {
                    reject(res.body);
                } else {
                    gistFile.content = res.body;
                    resovle(res.body);
                }
            });
        });
    }
    public getCommits(id: string): Promise<GistCommit[]> {
        return new Promise((resolve, reject) => {
            request.get(`${this.urlBase}/gists/${id}/commits`, {
                ... this.getHeader()
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
            request.get(`${this.urlBase}/gists/${id}/comments?page=${page}`, {
                ... this.getHeader()
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
                body: {body},
                ... this.getHeader()
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
            request.patch(`${this.urlBase}/gists/${id}/comments/${commentId}`, {
                body: {body},
                ... this.getHeader()
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
            request.delete(`${this.urlBase}/gists/${id}/comments/${commentId}`, {
                ... this.getHeader()
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