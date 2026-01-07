## 使用步骤:

1. 运行build.bat编译或从Release中下载FlashID2Chinese.exe。

2. 将FlashID2Chinese.exe移动至FlashID安装目录。

3. 以管理员身份运行FlashID2Chinese.exe。

4. 完成。

## 自动化构建与发布

GitHub Actions 支持手动触发自动化流程，按照版本号打包并发布 Release。

### 准备输入文件

将需要翻译的 `app.asar` 和对应的 `app.asar.unpacked` 目录放入版本号目录中：

```
inputs/<版本号>/app.asar
inputs/<版本号>/app.asar.unpacked/
```

例如：

```
inputs/1.2.3/app.asar
inputs/1.2.3/app.asar.unpacked/
```

### 触发流程

1. 进入 GitHub 仓库的 Actions 页面。
2. 选择 **Build and Release** 工作流。
3. 点击 **Run workflow**，输入版本号（例如 `1.2.3`）。

流程会自动执行以下操作：

- 解包 `app.asar`，将项目中的翻译内容追加到原始 `preload.js`。
- 合并 `app.asar.unpacked` 中的内容并完整打包为新的 `app.asar`。
- 构建 `FlashID2Chinese.exe`。
- 将生成的 `app.asar` 提交回仓库根目录。
- 按版本号发布到 Releases（标签为 `v<版本号>`）。

<img width="1470" height="767" alt="image" src="https://github.com/user-attachments/assets/2755682b-3034-4954-b088-456ac6c9a81e" />
<img width="2291" height="1419" alt="5841911bc6e0f0cf33eff27fdf172a56" src="https://github.com/user-attachments/assets/892487ba-cbcd-4a7d-ade2-50d9d18cde92" />
<img width="2284" height="1413" alt="bff278c47f15e59d194d866c4555b8ec" src="https://github.com/user-attachments/assets/2b12c3d7-0c1c-4dff-9eac-4e0e7d96de49" />
