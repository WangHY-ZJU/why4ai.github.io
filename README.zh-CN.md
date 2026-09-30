# Haoyu Wang 个人学术主页

这是一个轻量的静态学术主页。`data/site.json` 是个人内容的唯一来源，Python 只在本地预览和 GitHub Actions 构建时运行，访客访问的是 `dist/` 中的静态文件。

不要直接编辑 `dist/`；它是构建产物，每次构建都会重新生成。

当前仓库中的主页放在 `homepage/` 子目录，因为上级 ChatPort 仓库已有未提交的其他工作。若要建立个人主页仓库，建议新建或使用个人主页仓库（通常命名为 `<实际 GitHub 用户名>.github.io`），把 `homepage/` 内的源码内容复制到该仓库根目录。部署工作流会自动识别仓库根目录和 `homepage/` 子目录两种布局，无需手动修改。可直接使用 `output/deploy-source.zip`：解压后将**解压出的文件和目录**上传到新仓库根目录；不要把 ZIP 文件本身当作网站上传。本机没有 GitHub CLI 登录状态，也没有确认 Pages 仓库的发布授权，因此本次交付没有声称已经上线。

本地验收截图保存在 `output/playwright/home-375.png`、`home-768.png` 和 `home-1440.png`，分别对应 375px、768px 和 1440px 宽度。

## 本地预览

需要 Python 3，不需要安装第三方包：

```bash
cd homepage
python3 scripts/validate.py
python3 scripts/build.py
python3 scripts/serve.py
```

`serve.py` 会先校验并构建，然后打印：

- 主页：`http://127.0.0.1:8000/`
- 中文页：`http://127.0.0.1:8000/zh/`
- 维护页：`http://127.0.0.1:8000/editor/`

按 `Ctrl+C` 停止服务。也可以使用 `python3 scripts/serve.py --no-browser` 不自动打开浏览器。

## 中文维护页

打开 `/editor/` 后，页面会加载当前 `data/site.json`。维护页不是后台，没有登录、密码或远程写入功能；修改只存在于当前浏览器内存中。页面中的“草稿仅保存在当前浏览器，不代表已发布”提示适用于手动编辑过程。

1. 个人简介按段落逐行填写；研究方向一行一项。
2. 新增论文后，作者一行一个，顺序就是主页顺序；“进入精选论文”决定是否展示。
3. 用“上移”“下移”排列论文，用“删除”移除论文。删除前会确认。
4. News、教育经历、工作或研究经历、项目、学术服务都可以新增、编辑、删除和排序。空栏目自动隐藏。
5. 先点“预览”检查页面，再点“导出配置”下载新的 `site.json`。需要恢复以前版本时，点“导入配置”选择一份旧的 JSON；也可以用 GitHub 历史版本恢复 `data/site.json`。

导出前会进行格式校验。错误会显示在页面上，校验不通过时不会导出。导入和导出会保留字段与作者顺序。

## 图片和 CV

文件由 GitHub 仓库管理，不由维护页上传：

- 照片或论文配图放到 `assets/images/`，例如 `assets/images/profile.jpg` 或 `assets/images/texture-figure.png`，然后在表单中填写同一个相对路径和替代文本。
- CV 放到 `assets/files/`，例如 `assets/files/cv.pdf`，然后把这个路径填入 CV。校验会拒绝不在这两个目录中的本地路径。

构建只复制 `data/site.json` 中实际引用的图片和文件，不会把仓库中的草稿、备份或测试文件放进 `dist/`。图片加载失败时，论文条目会自动退回完整文字宽度。

## 发布到 GitHub Pages

工作流会在主分支更新或手动触发时执行：校验 → 构建 → 配置 Pages → 上传 Pages artifact → 部署。校验失败的运行会停止，不会用错误数据替换现有页面。工作流使用官方 `actions/checkout@v7`、`actions/setup-python@v6`、`actions/configure-pages@v6`、`actions/upload-pages-artifact@v5` 和 `actions/deploy-pages@v5`，权限只包括读取仓库、写入 Pages 和 OIDC 部署。

在目标仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。如果使用个人主页仓库，默认网址通常是 `https://<实际用户名>.github.io/`；不要根据姓名猜用户名。确认实际网址后，在维护页的“网站公开 URL”填写它，重新导出并提交，构建程序才会生成 canonical 和 sitemap。

目前已确认上级仓库的远程地址是 `https://github.com/WangHY-ZJU/ChatPort.git`，这只能说明仓库所有者字符串，不能证明当前环境有该账号的 GitHub 授权。部署剩余操作是：准备个人主页仓库、复制 `homepage/` 内容（或按上面的子目录工作流使用方式配置）、在 GitHub Pages 选择 Actions，并推送主分支。

## 数据字段速查

| 字段 | 用途与示例 |
| --- | --- |
| `profile.name` | 英文姓名，必填，例如 `Haoyu Wang` |
| `profile.bio` | 英文简介数组，一项一个段落 |
| `profile.research_interests` | 英文研究方向数组，一项一个方向 |
| `profile.photo` | `assets/images/` 下的图片路径；留空时无照片布局 |
| `publications.selected` | `true` 才会进入精选论文 |
| `publications.authors` | 作者数组，顺序必须与论文署名一致 |
| `publications.links` | `paper`、`scholar`、`code`、`project`，没有就留空 |
| `news[].date` | News 日期，可留空，不会自动填当前日期 |
| `education` / `experience` / `projects` / `service` | `period`、`title`、`organization`、`description`、`url` |
| `site.url` | 确认公网网址后填写；留空时不生成虚构的 canonical 或 sitemap |

未填写的字段使用空字符串或空数组。页面不会显示“待填写”“Coming soon”或空占位模块。
