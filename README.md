# LdgGist

> 基于 `Gitee` 和 `GitHub` 的代码片段管理工具

<p align="center">
  <img src="https://raw.githubusercontent.com/wanglong126/vscode-ldggist/main/resources/logo.png" alt="">
</p>

<p align="center">
  <a target="_blank" href='https://gitee.com/diycms/vscode-ldggist'><img src='https://img.shields.io/badge/dynamic/json?logo=Gitee&logoColor=C71D23&label=Stars&url=https://gitee.com/api/v5/repos/diycms/vscode-ldggist&query=$.stargazers_count' alt='star'></img></a>
  <a href="https://github.com/wanglong126/ldggist" target="_blank">
    <img alt="GitHub" src="https://img.shields.io/github/stars/wanglong126/ldggist?label=Stars&logo=GitHub">
  </a>
  <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=itldg.ldgGist&ssr=false#version-history">
    <img src="https://vsmarketplacebadge.apphb.com/version-short/itldg.ldgGist.svg?color=blue&style=?style=for-the-badge&logo=visual-studio-code" alt="">
  </a>
  <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=itldg.ldgGist&ssr=false#review-details">
    <img src="https://vsmarketplacebadge.apphb.com/rating-short/itldg.ldgGist.svg?color=blue" alt="">
  </a>
  <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=itldg.ldgGist">
    <img src="https://vsmarketplacebadge.apphb.com/installs-short/itldg.ldgGist.svg" alt="">
  </a>
</p>


## 快速开始

### 创建代码片段

![demo_create](https://raw.githubusercontent.com/wanglong126/vscode-ldggist/main/docs/gifs/create.gif)

### 删除文件或代码片段

![demo_delete](https://raw.githubusercontent.com/wanglong126/vscode-ldggist/main/docs/gifs/delete.gif)
## 功能

-   代码片段
    -   获取代码片段
    -   获取公开的代码片段`（仅GitHub）`
    -   用文件创建代码片段
    -   用选中内容创建代码片段
    -   将文件添加到已存在的代码片段
    -   将选中内容添加到已存在的代码片段
    -   修改描述
    -   编辑代码片段
    -   删除代码片段
    -   删除代码片段中的文件
    -   代码片段文件重命名
    -   代码片段发生改变后局部刷新
-   代码片段历史  [Gitee测试未返回正确结果](https://gitee.com/oschina/git-osc/issues/I5072D)
-   代码片段评论
    -   评论展示
    -   新增评论
    -   修改评论
    -   删除评论
-   多语言
    -   中文
    -   英文（机翻）


## 依赖权限

申请一个私人令牌(access token)

`Gitee`申请地址：https://gitee.com/profile/personal_access_tokens

| 功能  | 权限               |
| ----- | :----------------- |
| gists | 管理 Gist 代码片段 |

`GitHub`申请地址：https://github.com/settings/tokens

| 权限 | 用途         |
| ---- | :----------- |
| gist | Create gists |

## 开发初衷

希望可以摆脱文档记录常用代码的方式，在常用的代码编辑器中直接使用和修改常用的代码片段，感觉上美滋滋

## 常见问题

### 如何取消自动保存代码片段

修改设置`Auto Save`选择为`off`

## 开源

初次学习开发 Vs 扩展，代码凌乱不堪，无学习价值

希望各位大佬可以协助添砖加瓦，让其更加完善

开源地址：[GitHub](https://github.com/wanglong126/vscode-ldggist)    |   [Gitee](https://gitee.com/diycms/vscode-ldggist)

商店下载：[VS Marketplace](https://marketplace.visualstudio.com/items?itemName=itldg.ldgGist)

**Enjoy!**
